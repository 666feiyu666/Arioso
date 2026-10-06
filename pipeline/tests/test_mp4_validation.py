from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import run as pipeline_run  # noqa: E402


class Mp4ValidationTest(unittest.TestCase):
    def validate_with_delta(self, delta: float) -> dict:
        with tempfile.TemporaryDirectory(prefix='arioso-mp4-validation-') as temporary:
            root = Path(temporary)
            audio = root / 'audio.wav'
            video = root / 'video.mp4'
            cover = root / 'cover.png'
            audio.write_bytes(b'audio')
            video.write_bytes(b'video')
            cover.write_bytes(b'cover')

            def fake_measure(_ffmpeg: str, path: Path, log: Path) -> dict:
                if path == video:
                    log.write_text('Video: h264 1920x1080\nAudio: aac', encoding='utf-8')
                    duration = 100.0 - delta
                else:
                    duration = 100.0
                return {'duration_seconds': duration, 'true_peak_dbfs': -1.1,
                        'integrated_lufs': -18.0}

            with patch.object(pipeline_run, 'measure_audio', side_effect=fake_measure):
                return pipeline_run.validate_mp4(
                    {'ffmpeg': 'ffmpeg'}, audio, cover, video, root)

    def test_accepts_sub_two_second_audio_duration_delta(self) -> None:
        result = self.validate_with_delta(1.99)
        self.assertEqual(result['measurement']['duration_seconds'], 98.01)

    def test_rejects_audio_duration_delta_over_two_seconds(self) -> None:
        with self.assertRaisesRegex(ValueError, 'more than 2000 ms'):
            self.validate_with_delta(2.01)


if __name__ == '__main__':
    unittest.main()
