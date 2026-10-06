"""Local historical denoising and static-cover MP4 pipeline."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / 'pipeline/runtime/runtime.json'


def require_input(path: str | Path) -> Path:
    result = Path(path).expanduser().resolve()
    if not result.is_file():
        raise ValueError(f'Input file does not exist: {result}')
    return result


def require_new_output(path: str | Path, suffix: str) -> Path:
    result = Path(path).expanduser().absolute()
    if result.suffix.lower() != suffix:
        raise ValueError(f'Output must have the {suffix} extension: {result}')
    if result.exists() or result.is_symlink():
        raise ValueError(f'Refusing to overwrite existing output: {result}')
    result.parent.mkdir(parents=True, exist_ok=True)
    return result.resolve()


def read_runtime(config: Path, need_model: bool = False) -> dict:
    if not config.is_file():
        raise ValueError(f'Runtime is not configured. Run pipeline/setup.ps1 first: {config}')
    runtime = json.loads(config.read_text(encoding='utf-8-sig'))
    keys = ['ffmpeg'] + (['historical_python', 'historical_repository'] if need_model else [])
    for key in keys:
        if key not in runtime:
            raise ValueError(f'Missing runtime setting: {key}')
        p = Path(runtime[key])
        if not p.is_absolute() or not p.exists():
            raise ValueError(f'Runtime path is unavailable: {key}={p}')
    if need_model:
        repository = Path(runtime['historical_repository'])
        for relative in ['inference.py', 'experiments/trained_model/checkpoint.index',
                         'experiments/trained_model/checkpoint.data-00000-of-00001']:
            if not (repository / relative).is_file():
                raise ValueError(f'Missing historical model asset: {repository / relative}')
    return runtime


def execute(args: list[str], log: Path, cwd: Path | None = None,
            env: dict | None = None) -> str:
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True,
                            text=True, encoding='utf-8', errors='replace')
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}); see {log}\n'
                           + result.stderr[-1500:])
    return result.stdout + '\n' + result.stderr


def ffmpeg_args(ffmpeg: str) -> list[str]:
    return [ffmpeg, '-hide_banner', '-nostdin', '-nostats', '-n']


def finite_number(value: str) -> float | None:
    number = float(value)
    return number if math.isfinite(number) else None


def measure_audio(ffmpeg: str, audio: Path, log: Path) -> dict:
    text = execute(ffmpeg_args(ffmpeg) + ['-i', str(audio), '-map', '0:a:0',
        '-vn', '-af', 'ebur128=peak=true:framelog=verbose', '-progress', 'pipe:1',
        '-f', 'null', '-'], log)
    times = re.findall(r'^out_time_us=(\d+)$', text, flags=re.MULTILINE)
    peaks = re.findall(r'Peak:\s*([-+\d.]+|-inf)\s+dBFS', text)
    loudness = re.findall(r'I:\s*([-+\d.]+|-inf)\s+LUFS', text)
    if not times or int(times[-1]) <= 0 or not peaks:
        raise ValueError(f'Could not measure a non-empty audio stream: {audio}')
    return {'duration_seconds': int(times[-1]) / 1_000_000,
            'true_peak_dbfs': finite_number(peaks[-1]),
            'integrated_lufs': finite_number(loudness[-1]) if loudness else None}


def new_job(input_path: Path, requested: str | None = None) -> Path:
    if requested:
        job = Path(requested).expanduser().absolute()
    else:
        slug = re.sub(r'[^A-Za-z0-9_-]+', '-', input_path.stem).strip('-') or 'audio'
        job = ROOT / 'outputs/pipeline' / f'{slug}-{uuid.uuid4().hex[:8]}'
    if job.exists() or job.is_symlink():
        raise ValueError(f'Choose a new output directory: {job}')
    job.mkdir(parents=True)
    return job.resolve()


def source_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def export_audio(runtime: dict, source: Path, output: Path, job: Path,
                 denoise: bool) -> dict:
    ffmpeg = runtime['ffmpeg']
    decoded = job / 'input-float.wav'
    print('Decoding input to 44.1 kHz FLOAT WAV...', flush=True)
    execute(ffmpeg_args(ffmpeg) + ['-i', str(source), '-map', '0:a:0', '-vn',
        '-ar', '44100', '-c:a', 'pcm_f32le', str(decoded)], job / 'decode.log')
    working_audio = decoded
    if denoise:
        working_audio = job / 'denoised-float.wav'
        print('Running historical denoising (mono, CPU)...', flush=True)
        environment = os.environ.copy()
        environment.update({'CUDA_VISIBLE_DEVICES': '-1', 'TF_CPP_MIN_LOG_LEVEL': '2',
                            'TF_NUM_INTRAOP_THREADS': '4', 'TF_NUM_INTEROP_THREADS': '2'})
        execute([runtime['historical_python'], str(Path(__file__).with_name('historical_worker.py')),
            '--repository', runtime['historical_repository'], '--input', str(decoded),
            '--output', str(working_audio), '--log-dir', str(job / 'historical')],
            job / 'denoise.log', env=environment)
    measurement = measure_audio(ffmpeg, working_audio, job / 'raw-audio-measurement.log')
    peak = measurement['true_peak_dbfs']
    gain_db = min(0.0, -1.1 - peak) if peak is not None else 0.0
    print('Exporting 24-bit WAV with constant gain for peak headroom...', flush=True)
    execute(ffmpeg_args(ffmpeg) + ['-i', str(working_audio), '-map', '0:a:0',
        '-af', f'volume={gain_db:.6f}dB', '-c:a', 'pcm_s24le', str(output)],
        job / 'export-audio.log')
    final = measure_audio(ffmpeg, output, job / 'final-audio-measurement.log')
    if abs(final['duration_seconds'] - measurement['duration_seconds']) > 0.001:
        raise ValueError('Audio duration changed unexpectedly during export')
    if final['true_peak_dbfs'] is not None and final['true_peak_dbfs'] > -0.9:
        raise ValueError('Exported WAV does not have the expected peak headroom')
    if denoise:
        working_audio.unlink()
    decoded.unlink()
    return {'denoise': denoise, 'model_output_channels': 1 if denoise else 'preserved',
            'constant_gain_db': gain_db, 'raw_audio': measurement,
            'final_audio': final, 'output': str(output), 'sha256': source_hash(output)}


MAX_MP4_AUDIO_DURATION_DELTA_SECONDS = 2.0


def validate_mp4(runtime: dict, audio: Path, cover: Path | None, output: Path,
                 job: Path, input_measurement: dict | None = None) -> dict:
    ffmpeg = runtime['ffmpeg']
    measurement = input_measurement or measure_audio(
        ffmpeg, audio, job / 'mp4-input-measurement.log')
    duration = measurement['duration_seconds']
    peak = measurement['true_peak_dbfs']
    gain_db = min(0.0, -1.1 - peak) if peak is not None else 0.0
    result = measure_audio(ffmpeg, output, job / 'mp4-validation.log')
    text = (job / 'mp4-validation.log').read_text(encoding='utf-8')
    if 'Video: h264' not in text or '1920x1080' not in text or 'Audio: aac' not in text:
        raise ValueError('MP4 does not contain the expected video and audio streams')
    if abs(result['duration_seconds'] - duration) > MAX_MP4_AUDIO_DURATION_DELTA_SECONDS:
        raise ValueError('Encoded MP4 audio duration differs by more than 2000 ms')
    if result['true_peak_dbfs'] is not None and result['true_peak_dbfs'] > -0.1:
        raise ValueError('AAC export has no peak headroom; reduce the input level and use a new output path')
    return {'output': str(output), 'cover': str(cover) if cover else None,
            'constant_gain_db': gain_db,
            'video': 'H.264, 1920x1080, 30 fps, yuv420p', 'audio': 'AAC 192k',
            'measurement': result, 'sha256': source_hash(output)}


def export_mp4(runtime: dict, audio: Path, cover: Path | None, output: Path,
               job: Path) -> dict:
    ffmpeg = runtime['ffmpeg']
    measurement = measure_audio(ffmpeg, audio, job / 'mp4-input-measurement.log')
    duration = measurement['duration_seconds']
    peak = measurement['true_peak_dbfs']
    gain_db = min(0.0, -1.1 - peak) if peak is not None else 0.0
    args = ffmpeg_args(ffmpeg)
    if cover:
        args += ['-loop', '1', '-framerate', '1', '-i', str(cover)]
    else:
        args += ['-f', 'lavfi', '-i', 'color=c=0x111827:s=1920x1080:r=30']
    args += ['-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-vf',
        'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,'
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111827,setsar=1',
        '-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage', '-crf', '18',
        '-r', '30', '-pix_fmt', 'yuv420p', '-af', f'volume={gain_db:.6f}dB',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
        '-t', f'{duration:.6f}', '-shortest', '-movflags', '+faststart', str(output)]
    print('Creating 1080p H.264 / AAC MP4...', flush=True)
    execute(args, job / 'mp4-encode.log')
    return validate_mp4(runtime, audio, cover, output, job, measurement)


def write_manifest(job: Path, source: Path, before_hash: str, runtime: dict,
                   results: dict) -> None:
    if source_hash(source) != before_hash:
        raise RuntimeError('Source file checksum changed')
    manifest = {'source': str(source), 'source_sha256': before_hash,
                'source_unchanged': True, 'runtime': runtime, 'results': results}
    (job / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Run records: {job}', flush=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    commands = result.add_subparsers(dest='command', required=True)
    commands.add_parser('doctor', help='Check runtime paths and available codecs')
    denoise = commands.add_parser('denoise', help='Export historical-denoised mono WAV')
    denoise.add_argument('input')
    denoise.add_argument('-o', '--output', required=True)
    video = commands.add_parser('mp4', help='Combine audio and a cover or plain background')
    video.add_argument('input')
    video.add_argument('-o', '--output', required=True)
    video.add_argument('--cover')
    album = commands.add_parser('album', help='Denoise numbered album tracks and create one MP4')
    album.add_argument('input', help='Directory of numbered MP3 tracks or an ordered JSON source manifest')
    album.add_argument('--cover', help='Optional cover image; omit to skip MP4 creation')
    album.add_argument('--title', default='Album')
    album.add_argument('--output-dir')
    album.add_argument('--resume', action='store_true',
                       help='Resume an existing output directory from verified checkpoints')
    album.add_argument('--workers', type=int, choices=[1, 2], default=2)
    album.add_argument('--order', help='Optional complete track-number order, separated by commas')
    both = commands.add_parser('run', help='Denoise and create MP4 in one run')
    both.add_argument('input')
    both.add_argument('--cover')
    both.add_argument('--output-dir')
    both.add_argument('--skip-denoise', action='store_true')
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    needs_model = args.command in ('denoise', 'album') or (args.command == 'run' and not args.skip_denoise)
    runtime = read_runtime(args.config.resolve(), needs_model)
    if args.command == 'doctor':
        runtime = read_runtime(args.config.resolve(), True)
        check_dir = args.config.resolve().parent / 'diagnostics'
        encoders = execute([runtime['ffmpeg'], '-hide_banner', '-encoders'], check_dir / 'ffmpeg.log')
        if 'libx264' not in encoders or ' aac ' not in encoders:
            raise ValueError('FFmpeg requires libx264 and AAC encoding')
        environment = os.environ.copy()
        environment.update({'CUDA_VISIBLE_DEVICES': '-1', 'TF_CPP_MIN_LOG_LEVEL': '2'})
        execute([runtime['historical_python'], '-c',
            'import tensorflow as tf, numpy; print(tf.__version__, numpy.__version__)'],
            check_dir / 'historical.log', env=environment)
        print('Runtime ready: historical denoising + H.264/AAC MP4')
        return 0
    if args.command == 'album':
        from album import execute_album
        execute_album(args, runtime)
        return 0
    source = require_input(args.input)
    cover = require_input(args.cover) if getattr(args, 'cover', None) else None
    before = source_hash(source)
    if args.command == 'denoise':
        output = require_new_output(args.output, '.wav')
        job = new_job(source)
        results = {'audio': export_audio(runtime, source, output, job, True)}
    elif args.command == 'mp4':
        output = require_new_output(args.output, '.mp4')
        job = new_job(source)
        results = {'mp4': export_mp4(runtime, source, cover, output, job)}
    else:
        job = new_job(source, args.output_dir)
        audio = job / ('audio.wav' if args.skip_denoise else 'audio-denoised.wav')
        results = {'audio': export_audio(runtime, source, audio, job, not args.skip_denoise)}
        results['mp4'] = export_mp4(runtime, audio, cover, job / 'video.mp4', job)
    write_manifest(job, source, before, runtime, results)
    for result in results.values():
        print(f"Output: {result['output']}", flush=True)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f'Pipeline error: {error}', file=sys.stderr)
        raise SystemExit(1)
