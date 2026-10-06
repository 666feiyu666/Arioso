"""Historical-denoised album export with shared gain and a static cover."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import os
from pathlib import Path
import re
import wave

from run import (execute, export_mp4, ffmpeg_args, measure_audio, new_job,
                 require_input, source_hash, validate_mp4)


def ordered_tracks(paths: list[Path], order: str | None = None) -> list[dict]:
    """Require unique, consecutive source numbers before applying an order."""
    numbered = {}
    for path in paths:
        match = re.match(r'^(\d+)(?!\d)[\s._-]*(.*)$', path.stem)
        if not match or not match.group(2).strip():
            raise ValueError(f'MP3 filename needs a numeric prefix and title: {path.name}')
        number = int(match.group(1))
        if number in numbered:
            raise ValueError(f'Duplicate track number {number}: {path.name}')
        numbered[number] = {'track_number': number, 'title': match.group(2).strip(),
                            'source': path}
    if not numbered:
        raise ValueError('The input directory contains no MP3 files')
    expected = list(range(1, len(numbered) + 1))
    if sorted(numbered) != expected:
        raise ValueError(f'Track numbers must be consecutive 1..{len(numbered)}')
    sequence = expected
    if order is not None:
        parts = order.split(',')
        if not parts or any(not re.fullmatch(r'\s*\d+\s*', part) for part in parts):
            raise ValueError('--order must be a comma-separated list of track numbers')
        sequence = [int(part) for part in parts]
        if sorted(sequence) != expected:
            raise ValueError('--order must contain every track number exactly once')
    return [numbered[number] for number in sequence]


def manifest_tracks(manifest: Path) -> list[dict]:
    """Load an ordered source list without copying task audio into a staging directory."""
    value = json.loads(manifest.read_text(encoding='utf-8-sig'))
    if not isinstance(value, list) or not value:
        raise ValueError('The album source manifest must be a non-empty JSON array')
    tracks = []
    seen = set()
    for position, item in enumerate(value, 1):
        if not isinstance(item, dict) or not isinstance(item.get('file'), str):
            raise ValueError(f'Album source {position} needs a file path')
        source = require_input(item['file'])
        if source.suffix.lower() != '.mp3':
            raise ValueError(f'Album source must be MP3: {source}')
        if source in seen:
            raise ValueError(f'Duplicate album source: {source}')
        seen.add(source)
        title = item.get('title')
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f'Album source {position} needs a title')
        if any(ord(character) < 32 for character in title):
            raise ValueError(f'Album source {position} title contains a control character')
        digest = source_hash(source)
        expected = item.get('hash')
        if expected is not None and expected != digest:
            raise RuntimeError(f'Album source checksum changed: {source}')
        tracks.append({'track_number': position, 'title': title.strip(),
                       'source': source, 'source_sha256': digest})
    return tracks


def timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, fraction = divmod(remainder, 1000)
    return f'{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{fraction:03d}'


def tracklist_timestamp(seconds: float) -> str:
    total_seconds = int(seconds)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, whole_seconds = divmod(remainder, 60)
    if hours:
        return f'{hours:02d}:{minutes:02d}:{whole_seconds:02d}'
    return f'{minutes:02d}:{whole_seconds:02d}'


def concat_quote(path: str) -> str:
    if '\n' in path or '\r' in path or '\x00' in path:
        raise ValueError('Invalid control character in concat path')
    return "'" + path.replace("'", "'\\''") + "'"


def pcm_info(path: Path) -> dict:
    try:
        with wave.open(str(path), 'rb') as audio:
            if (audio.getnchannels(), audio.getframerate(), audio.getsampwidth()) != (1, 44100, 3):
                raise ValueError(f'Expected 44.1 kHz mono PCM24 WAV: {path}')
            frames = audio.getnframes()
    except wave.Error as error:
        raise ValueError(f'Cannot verify PCM WAV {path}: {error}') from error
    if frames <= 0:
        raise ValueError(f'Empty WAV output: {path}')
    return {'frames': frames, 'sample_rate': 44100, 'channels': 1,
            'bits_per_sample': 24, 'duration_seconds': frames / 44100}


def atomic_json(path: Path, value: dict) -> None:
    """Persist a checkpoint without exposing a partially-written JSON file."""
    temporary = path.with_name('.' + path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


def checkpoint_file(path: Path, digest: object) -> bool:
    return (isinstance(digest, str) and path.is_file() and not path.is_symlink()
            and source_hash(path) == digest)


def denoised_record(track: dict, job: Path, checkpoint: object) -> dict | None:
    if not isinstance(checkpoint, dict):
        return None
    raw_audio = checkpoint.get('raw_audio')
    frames = checkpoint.get('frames')
    peak = raw_audio.get('true_peak_dbfs') if isinstance(raw_audio, dict) else None
    if (checkpoint.get('source_sha256') != track['source_sha256']
            or not isinstance(frames, int) or frames <= 0
            or not isinstance(raw_audio, dict)
            or not isinstance(raw_audio.get('duration_seconds'), (int, float))
            or (peak is not None and (not isinstance(peak, (int, float)) or not math.isfinite(peak)))
            or abs(raw_audio['duration_seconds'] - frames / 44100) >= 0.002):
        return None
    directory = job / 'tracks' / f'{track["track_number"]:02d}'
    raw = directory / 'denoised-float.wav'
    return {**track, 'directory': directory, 'raw': raw, 'frames': frames,
            'duration_seconds': frames / 44100, 'raw_audio': raw_audio,
            'raw_sha256': checkpoint.get('raw_sha256'),
            'worker_transport': checkpoint.get('worker_transport')}


def exported_track_valid(record: dict, checkpoint: object, gain_db: float | None) -> bool:
    if not isinstance(checkpoint, dict) or gain_db is None:
        return False
    output = record['directory'] / 'audio-denoised.wav'
    if (not isinstance(checkpoint.get('constant_gain_db'), (int, float))
            or abs(checkpoint['constant_gain_db'] - gain_db) >= 1e-9
            or not isinstance(checkpoint.get('final_audio'), dict)
            or not checkpoint_file(output, checkpoint.get('sha256'))):
        return False
    try:
        return pcm_info(output)['frames'] == record['frames']
    except (OSError, ValueError):
        return False


def raw_track_valid(record: dict) -> bool:
    return checkpoint_file(record['raw'], record.get('raw_sha256'))


def denoise_track(track: dict, runtime: dict, job: Path, total: int) -> dict:
    number = track['track_number']
    directory = job / 'tracks' / f'{number:02d}'
    directory.mkdir(parents=True)
    decoded = directory / 'input-float.wav'
    raw = directory / 'denoised-float.wav'
    for stale in (decoded, raw):
        if stale.exists() or stale.is_symlink():
            stale.unlink()
    ffmpeg = runtime['ffmpeg']
    print(f'[{number:02d}/{total:02d}] Decoding {track["title"]}', flush=True)
    execute(ffmpeg_args(ffmpeg) + ['-i', str(track['source']), '-map', '0:a:0',
        '-vn', '-ar', '44100', '-c:a', 'pcm_f32le', str(decoded)], directory / 'decode.log')
    environment = os.environ.copy()
    environment.update({'CUDA_VISIBLE_DEVICES': '-1', 'TF_CPP_MIN_LOG_LEVEL': '2',
                        'TF_NUM_INTRAOP_THREADS': '4', 'TF_NUM_INTEROP_THREADS': '2'})
    print(f'[{number:02d}/{total:02d}] Historical denoising', flush=True)
    execute([runtime['historical_python'], str(Path(__file__).with_name('historical_worker.py')),
        '--repository', runtime['historical_repository'], '--input', str(decoded),
        '--output', str(raw), '--log-dir', str(directory / 'historical')],
        directory / 'denoise.log', env=environment)
    transport = json.loads((directory / 'historical/historical-transport.json').read_text(encoding='utf-8'))
    record = transport['outputs'][decoded.stem + '_denoised.wav']
    if (record['sample_rate'], record['channels'], record['subtype']) != (44100, 1, 'FLOAT'):
        raise ValueError(f'Unexpected historical output format for track {number}')
    frames = int(record['frames'])
    if frames <= 0:
        raise ValueError(f'Empty historical output for track {number}')
    measurement = measure_audio(ffmpeg, raw, directory / 'raw-audio-measurement.log')
    if abs(measurement['duration_seconds'] - frames / 44100) >= 0.002:
        raise ValueError(f'Historical duration verification failed for track {number}')
    decoded.unlink()
    return {**track, 'directory': directory, 'raw': raw, 'frames': frames,
            'duration_seconds': frames / 44100, 'raw_audio': measurement,
            'raw_sha256': source_hash(raw),
            'worker_transport': str(directory / 'historical/historical-transport.json')}


def execute_album(args, runtime: dict) -> dict:
    workers = getattr(args, 'workers', 2)
    if not isinstance(workers, int) or not 1 <= workers <= 2:
        raise ValueError('--workers must be 1 or 2')
    album_input = Path(args.input).expanduser().resolve()
    cover = require_input(args.cover) if getattr(args, 'cover', None) else None
    if album_input.is_dir():
        tracks = ordered_tracks([path for path in album_input.iterdir()
                                 if path.is_file() and path.suffix.lower() == '.mp3'],
                                getattr(args, 'order', None))
        for track in tracks:
            track['source'] = require_input(track['source'])
            track['source_sha256'] = source_hash(track['source'])
    elif album_input.is_file():
        if getattr(args, 'order', None) is not None:
            raise ValueError('--order cannot be combined with an album source manifest')
        tracks = manifest_tracks(album_input)
    else:
        raise ValueError(f'Album input does not exist: {album_input}')
    cover_hash = source_hash(cover) if cover else None
    resume = getattr(args, 'resume', False)
    if resume:
        if not args.output_dir:
            raise ValueError('--resume requires --output-dir')
        job = Path(args.output_dir).expanduser().absolute()
        if job.is_symlink() or not job.is_dir():
            raise ValueError(f'Cannot resume missing or unsafe output directory: {job}')
        job = job.resolve()
    else:
        job = new_job(album_input, args.output_dir)
    state_path = job / 'run-state.json'
    track_signature = [{'track_number': track['track_number'], 'title': track['title'],
        'source': str(track['source']), 'source_sha256': track['source_sha256']} for track in tracks]
    runtime_signature = {'historical_commit': runtime.get('historical_commit'),
        'checkpoint_sha256': runtime.get('checkpoint_sha256')}
    if resume:
        if not state_path.is_file() or state_path.is_symlink():
            raise ValueError(f'Resumable checkpoint is missing: {state_path}')
        state = json.loads(state_path.read_text(encoding='utf-8-sig'))
        if (not isinstance(state, dict) or state.get('version') != 1
                or state.get('tracks_signature') != track_signature
                or state.get('runtime_signature') != runtime_signature):
            raise ValueError('Production checkpoint does not match the current sources or denoiser')
    else:
        state = {'version': 1, 'phase': 'denoising', 'tracks_signature': track_signature,
                 'runtime_signature': runtime_signature, 'tracks': {}}
        atomic_json(state_path, state)

    if cover:
        execute(ffmpeg_args(runtime['ffmpeg']) + ['-i', str(cover), '-map', '0:v:0',
            '-frames:v', '1', '-f', 'null', '-'], job / 'cover-validation.log')

    print(f'Checking {len(tracks)} track checkpoint(s)', flush=True)
    completed = {}
    pending = []
    saved_gain = state.get('constant_gain_db')
    if not isinstance(saved_gain, (int, float)) or not math.isfinite(saved_gain):
        saved_gain = None
    track_states = state.setdefault('tracks', {})
    if not isinstance(track_states, dict):
        raise ValueError('Invalid production track checkpoint table')
    for track in tracks:
        saved = track_states.get(str(track['track_number']))
        denoised = saved.get('denoised') if isinstance(saved, dict) else None
        record = denoised_record(track, job, denoised)
        exported = saved.get('exported') if isinstance(saved, dict) else None
        if record and (raw_track_valid(record) or exported_track_valid(record, exported, saved_gain)):
            completed[track['track_number']] = record
            print(f'[{track["track_number"]:02d}/{len(tracks):02d}] Reusing verified denoise checkpoint', flush=True)
        else:
            pending.append(track)

    if pending:
        print(f'Denoising {len(pending)} missing or invalid track(s) with {workers} historical worker(s)', flush=True)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(denoise_track, track, runtime, job, len(tracks)): track
                       for track in pending}
            try:
                for future in as_completed(futures):
                    record = future.result()
                    number = record['track_number']
                    completed[number] = record
                    track_states[str(number)] = {'denoised': {
                        'source_sha256': record['source_sha256'], 'frames': record['frames'],
                        'duration_seconds': record['duration_seconds'], 'raw_audio': record['raw_audio'],
                        'raw_sha256': record['raw_sha256'],
                        'worker_transport': record['worker_transport']}}
                    state['phase'] = 'denoising'
                    atomic_json(state_path, state)
                    print(f'[{len(completed):02d}/{len(tracks):02d} complete] '
                          f'Track {number:02d}: {record["title"]}', flush=True)
            except BaseException:
                for future in futures:
                    future.cancel()
                raise
    records = [completed[track['track_number']] for track in tracks]
    peaks = [record['raw_audio']['true_peak_dbfs'] for record in records
             if record['raw_audio']['true_peak_dbfs'] is not None]
    if any(not math.isfinite(peak) for peak in peaks):
        raise ValueError('Historical output has an invalid peak measurement')
    maximum_peak = max(peaks) if peaks else None
    gain_db = min(0.0, -1.1 - maximum_peak) if maximum_peak is not None else 0.0
    state['maximum_raw_true_peak_dbfs'] = maximum_peak
    state['constant_gain_db'] = gain_db
    state['phase'] = 'exporting_tracks'
    atomic_json(state_path, state)
    print(f'Applying one album gain to every track: {gain_db:.6f} dB', flush=True)
    track_manifest = []
    for position, record in enumerate(records, 1):
        output = record['directory'] / 'audio-denoised.wav'
        saved = track_states.get(str(record['track_number']))
        exported = saved.get('exported') if isinstance(saved, dict) else None
        if exported_track_valid(record, exported, gain_db):
            info = pcm_info(output)
            final_audio = exported['final_audio']
            print(f'[{record["track_number"]:02d}/{len(records):02d}] Reusing verified PCM export', flush=True)
        else:
            if not raw_track_valid(record):
                raise RuntimeError(f'Missing verified denoised checkpoint for track {record["track_number"]}')
            if output.exists() or output.is_symlink():
                output.unlink()
            execute(ffmpeg_args(runtime['ffmpeg']) + ['-i', str(record['raw']), '-map', '0:a:0',
                '-af', f'volume={gain_db:.9f}dB', '-ar', '44100', '-ac', '1',
                '-c:a', 'pcm_s24le', str(output)], record['directory'] / 'export-audio.log')
            info = pcm_info(output)
            if info['frames'] != record['frames']:
                raise ValueError(f'Frame count changed for track {record["track_number"]}')
            final_audio = measure_audio(runtime['ffmpeg'], output, record['directory'] / 'final-audio-measurement.log')
            if final_audio['true_peak_dbfs'] is not None and final_audio['true_peak_dbfs'] > -0.9:
                raise ValueError(f'Insufficient PCM peak headroom for track {record["track_number"]}')
            exported = {'constant_gain_db': gain_db, 'sha256': source_hash(output),
                        'pcm': info, 'final_audio': final_audio}
            track_states[str(record['track_number'])]['exported'] = exported
            atomic_json(state_path, state)
        if raw_track_valid(record):
            record['raw'].unlink()
        track_manifest.append({'position': position, 'track_number': record['track_number'],
            'title': record['title'], 'source': str(record['source']),
            'source_sha256': record['source_sha256'], 'duration_seconds': record['duration_seconds'],
            'constant_gain_db': gain_db, 'raw_audio': record['raw_audio'],
            'worker_transport': record['worker_transport'], 'output': str(output),
            'sha256': exported['sha256'], 'pcm': info, 'final_audio': final_audio})

    playlist = job / 'concat.txt'
    with playlist.open('w', encoding='utf-8', newline='\n') as handle:
        handle.write('ffconcat version 1.0\n')
        for track in track_manifest:
            relative = Path(track['output']).relative_to(job).as_posix()
            handle.write('file ' + concat_quote(relative) + '\n')
    album_audio = job / 'album-denoised.wav'
    expected_frames = sum(track['pcm']['frames'] for track in track_manifest)
    expected_duration = expected_frames / 44100
    track_hashes = [track['sha256'] for track in track_manifest]
    album_state = state.get('album')
    album_valid = (isinstance(album_state, dict)
                   and isinstance(album_state.get('measurement'), dict)
                   and album_state.get('track_sha256') == track_hashes
                   and checkpoint_file(album_audio, album_state.get('sha256')))
    if album_valid:
        try:
            album_info = pcm_info(album_audio)
            album_valid = album_info['frames'] == expected_frames
        except (OSError, ValueError):
            album_valid = False
    if album_valid:
        album_measurement = album_state['measurement']
        print('Reusing verified concatenated album WAV', flush=True)
    else:
        if album_audio.exists() or album_audio.is_symlink():
            album_audio.unlink()
        print('Concatenating PCM tracks in the requested order without added gaps', flush=True)
        execute(ffmpeg_args(runtime['ffmpeg']) + ['-f', 'concat', '-safe', '0', '-i', str(playlist),
            '-map', '0:a:0', '-c:a', 'copy', str(album_audio)], job / 'concat.log')
        album_info = pcm_info(album_audio)
        if album_info['frames'] != expected_frames:
            raise ValueError('Concatenated WAV does not contain the exact sum of track frames')
        album_measurement = measure_audio(runtime['ffmpeg'], album_audio, job / 'album-audio-measurement.log')
        if abs(album_measurement['duration_seconds'] - expected_duration) >= 0.002:
            raise ValueError('Concatenated duration differs from the track sum by 2 ms or more')
        if album_measurement['true_peak_dbfs'] is not None and album_measurement['true_peak_dbfs'] > -0.9:
            raise ValueError('Joined album has insufficient peak headroom')
        state['album'] = {'sha256': source_hash(album_audio), 'pcm': album_info,
                          'measurement': album_measurement,
                          'track_sha256': track_hashes,
                          'expected_duration_seconds': expected_duration}
        state['phase'] = 'album_complete'
        atomic_json(state_path, state)
    tracklist_entries = []
    tracklist_frames = 0
    for track in track_manifest:
        tracklist_entries.append(f'{tracklist_timestamp(tracklist_frames / 44100)} {track["title"]}')
        tracklist_frames += track['pcm']['frames']
    with (job / 'tracklist.txt').open('w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n\n'.join(tracklist_entries) + '\n')
    running_frames = 0
    with (job / 'chapters.txt').open('w', encoding='utf-8') as handle:
        for track in track_manifest:
            track['start_seconds'] = running_frames / 44100
            handle.write(f'{timestamp(track["start_seconds"])} {track["position"]:02d}. {track["title"]}\n')
            running_frames += track['pcm']['frames']
            track['end_seconds'] = running_frames / 44100
    video = None
    video_path = job / 'video.mp4'
    video_state = state.get('mp4')
    album_hash = state['album']['sha256']
    if cover:
        video_valid = (isinstance(video_state, dict)
                       and isinstance(video_state.get('manifest'), dict)
                       and video_state.get('cover_sha256') == cover_hash
                       and video_state.get('album_sha256') == album_hash
                       and checkpoint_file(video_path, video_state.get('sha256')))
        if video_valid:
            video = video_state['manifest']
            print('Reusing verified MP4 export', flush=True)
        else:
            if (resume and video_state is None and video_path.is_file()
                    and not video_path.is_symlink()):
                try:
                    video = validate_mp4(runtime, album_audio, cover, video_path, job)
                    print('Recovered and reused existing verified MP4 export', flush=True)
                except (OSError, RuntimeError, ValueError) as error:
                    print(f'Existing MP4 failed validation; regenerating: {error}', flush=True)
            if video_path.exists() or video_path.is_symlink():
                if video is None:
                    video_path.unlink()
            if video is None:
                video = export_mp4(runtime, album_audio, cover, video_path, job)
            state['mp4'] = {'cover_sha256': cover_hash, 'album_sha256': album_hash,
                            'sha256': video['sha256'], 'manifest': video}
            state['phase'] = 'video_complete'
            atomic_json(state_path, state)
    else:
        state.pop('mp4', None)
        if video_path.exists() or video_path.is_symlink():
            video_path.unlink()
    for track in tracks:
        if source_hash(track['source']) != track['source_sha256']:
            raise RuntimeError(f'Source checksum changed: {track["source"]}')
    if cover and source_hash(cover) != cover_hash:
        raise RuntimeError('Cover checksum changed')
    manifest = {'title': args.title, 'input': str(album_input),
        'source_unchanged': True, 'cover': ({'source': str(cover),
        'sha256': cover_hash, 'source_unchanged': True} if cover else None), 'runtime': runtime,
        'denoiser': 'denoising-historical-recordings', 'workers': workers,
        'track_order': [track['track_number'] for track in tracks],
        'maximum_raw_true_peak_dbfs': maximum_peak, 'constant_gain_db': gain_db,
        'tracks': track_manifest, 'audio': {'output': str(album_audio), 'pcm': album_info,
        'measurement': album_measurement, 'expected_duration_seconds': expected_duration,
        'sha256': album_hash}, 'mp4': video,
        'tracklist': str(job / 'tracklist.txt'), 'chapters': str(job / 'chapters.txt')}
    atomic_json(job / 'manifest.json', manifest)
    state['phase'] = 'completed'
    atomic_json(state_path, state)
    video_message = f'Album MP4: {video["output"]}' if video else 'Album MP4: skipped (no cover)'
    print(f'Album WAV: {album_audio}\n{video_message}\nRun records: {job}', flush=True)
    return manifest
