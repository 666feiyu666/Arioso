from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import album  # noqa: E402


class AlbumResumeTest(unittest.TestCase):
    def test_denoise_reuses_partial_track_directory(self) -> None:
        with tempfile.TemporaryDirectory(prefix='arioso-album-partial-') as temporary:
            root = Path(temporary)
            source = root / '01 Track.mp3'
            source.write_bytes(b'source')
            job = root / 'production'
            directory = job / 'tracks' / '01'
            historical = directory / 'historical'
            historical.mkdir(parents=True)
            (directory / 'input-float.wav').write_bytes(b'partial-input')
            (directory / 'denoised-float.wav').write_bytes(b'partial-output')
            (historical / 'historical-transport.json').write_text('{}', encoding='utf-8')
            track = {'track_number': 1, 'title': 'Track', 'source': source,
                     'source_sha256': album.source_hash(source)}
            runtime = {'ffmpeg': 'ffmpeg', 'historical_python': 'python',
                       'historical_repository': 'repository'}

            def fake_execute(arguments: list[str], _log: Path, **_kwargs: object) -> str:
                if '--output' in arguments:
                    raw = Path(arguments[arguments.index('--output') + 1])
                    transport = Path(arguments[arguments.index('--log-dir') + 1]) / 'historical-transport.json'
                    self.assertFalse(raw.exists())
                    self.assertFalse(transport.exists())
                    raw.write_bytes(b'fresh-output')
                    transport.write_text(json.dumps({'outputs': {
                        'input-float_denoised.wav': {
                            'sample_rate': 44100, 'channels': 1, 'subtype': 'FLOAT',
                            'frames': 100,
                        },
                    }}), encoding='utf-8')
                else:
                    Path(arguments[-1]).write_bytes(b'fresh-input')
                return ''

            with patch.object(album, 'execute', side_effect=fake_execute), \
                    patch.object(album, 'measure_audio', return_value={
                        'duration_seconds': 100 / 44100, 'true_peak_dbfs': -2.0,
                        'integrated_lufs': -20.0,
                    }):
                record = album.denoise_track(track, runtime, job, 1)

            self.assertEqual(record['frames'], 100)
            self.assertEqual(record['raw'].read_bytes(), b'fresh-output')
            self.assertFalse((directory / 'input-float.wav').exists())

    def test_resume_reuses_verified_tracks_and_repairs_only_corrupt_track(self) -> None:
        with tempfile.TemporaryDirectory(prefix='arioso-album-resume-') as temporary:
            root = Path(temporary)
            sources = []
            for number in (1, 2):
                source = root / f'{number:02d} Track {number}.mp3'
                source.write_bytes(f'source-{number}'.encode())
                sources.append({'file': str(source), 'title': f'Track {number}',
                                'hash': album.source_hash(source)})
            source_manifest = root / 'sources.json'
            source_manifest.write_text(json.dumps(sources), encoding='utf-8')
            output = root / 'production'
            runtime = {'ffmpeg': 'ffmpeg', 'historical_python': 'python',
                       'historical_repository': 'repository', 'historical_commit': 'commit',
                       'checkpoint_sha256': 'checkpoint'}
            calls: list[int] = []
            video_calls: list[str] = []
            recovered_video_calls: list[str] = []
            fail_track_two = True

            def fake_denoise(track: dict, _runtime: dict, job: Path, _total: int) -> dict:
                nonlocal fail_track_two
                number = track['track_number']
                calls.append(number)
                if number == 2 and fail_track_two:
                    fail_track_two = False
                    raise RuntimeError('interrupted')
                directory = job / 'tracks' / f'{number:02d}'
                directory.mkdir(parents=True, exist_ok=True)
                raw = directory / 'denoised-float.wav'
                raw.write_bytes(f'raw-{number}'.encode())
                return {**track, 'directory': directory, 'raw': raw, 'frames': 100,
                        'duration_seconds': 100 / 44100,
                        'raw_audio': {'duration_seconds': 100 / 44100,
                                      'true_peak_dbfs': -2.0, 'integrated_lufs': -20.0},
                        'raw_sha256': album.source_hash(raw),
                        'worker_transport': str(directory / 'historical-transport.json')}

            def fake_execute(arguments: list[str], _log: Path, **_kwargs: object) -> str:
                target = Path(arguments[-1])
                if target.suffix == '.wav':
                    target.write_bytes(b'album' if target.name == 'album-denoised.wav'
                                       else f'final-{target.parent.name}'.encode())
                return ''

            def fake_pcm(path: Path) -> dict:
                frames = 200 if path.name == 'album-denoised.wav' else 100
                return {'frames': frames, 'sample_rate': 44100, 'channels': 1,
                        'bits_per_sample': 24, 'duration_seconds': frames / 44100}

            def fake_measure(_ffmpeg: str, path: Path, _log: Path) -> dict:
                frames = 200 if path.name == 'album-denoised.wav' else 100
                return {'duration_seconds': frames / 44100, 'true_peak_dbfs': -2.0,
                        'integrated_lufs': -20.0}

            def fake_video(_runtime: dict, _audio: Path, cover: Path, target: Path,
                           _job: Path) -> dict:
                video_calls.append(album.source_hash(cover))
                target.write_bytes(b'video')
                return {'output': str(target), 'cover': str(cover),
                        'sha256': album.source_hash(target)}

            def fake_validate_video(_runtime: dict, _audio: Path, cover: Path,
                                    target: Path, _job: Path) -> dict:
                recovered_video_calls.append(album.source_hash(cover))
                return {'output': str(target), 'cover': str(cover),
                        'sha256': album.source_hash(target)}

            initial = argparse.Namespace(input=str(source_manifest), cover=None, order=None,
                                         title='Test', output_dir=str(output), workers=1,
                                         resume=False)
            with patch.object(album, 'denoise_track', side_effect=fake_denoise), \
                    patch.object(album, 'execute', side_effect=fake_execute), \
                    patch.object(album, 'pcm_info', side_effect=fake_pcm), \
                    patch.object(album, 'measure_audio', side_effect=fake_measure), \
                    patch.object(album, 'export_mp4', side_effect=fake_video), \
                    patch.object(album, 'validate_mp4', side_effect=fake_validate_video):
                with self.assertRaisesRegex(RuntimeError, 'interrupted'):
                    album.execute_album(initial, runtime)
                self.assertEqual(calls, [1, 2])

                calls.clear()
                initial.resume = True
                album.execute_album(initial, runtime)
                self.assertEqual(calls, [2])
                self.assertEqual(json.loads((output / 'run-state.json').read_text())['phase'], 'completed')

                calls.clear()
                (output / 'tracks/01/audio-denoised.wav').write_bytes(b'corrupt')
                album.execute_album(initial, runtime)
                self.assertEqual(calls, [1])

                calls.clear()
                cover = root / 'cover.png'
                cover.write_bytes(b'cover')
                initial.cover = str(cover)
                album.execute_album(initial, runtime)
                self.assertEqual(calls, [])
                self.assertEqual(len(video_calls), 1)

                state_path = output / 'run-state.json'
                state = json.loads(state_path.read_text())
                state.pop('mp4')
                state['phase'] = 'album_complete'
                state_path.write_text(json.dumps(state), encoding='utf-8')
                album.execute_album(initial, runtime)
                self.assertEqual(len(video_calls), 1)
                self.assertEqual(len(recovered_video_calls), 1)
                self.assertEqual(json.loads(state_path.read_text())['phase'], 'completed')

                (output / 'video.mp4').write_bytes(b'corrupt')
                album.execute_album(initial, runtime)
                self.assertEqual(calls, [])
                self.assertEqual(len(video_calls), 2)


if __name__ == '__main__':
    unittest.main()
