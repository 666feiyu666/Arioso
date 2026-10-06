"""Run the official historical denoiser with unclipped FLOAT WAV transport.

Execute this worker with the isolated Python 3.8 / TensorFlow 2.3 interpreter.
The official model and inference code are loaded from --repository unchanged.
"""

import argparse
import json
import os
from pathlib import Path
import runpy
import sys


TESTED_REPOSITORY_COMMIT = "114fce7c849c5c5ed9c1c69bdb1610a5b949796b"


def absolute_path(value):
    path = Path(value)
    if not path.is_absolute():
        raise argparse.ArgumentTypeError("An absolute path is required: {}".format(value))
    return Path(os.path.abspath(str(path)))


def path_exists(path):
    # lexists also detects a dangling symlink, which must not be overwritten.
    return os.path.lexists(str(path))


def is_inside(path, directory):
    try:
        path.relative_to(directory)
    except ValueError:
        return False
    return True


def write_float_exclusive(write_audio, destination, data, samplerate):
    """Write through the original SoundFile backend without overwriting a file."""
    created = False
    try:
        with destination.open("xb") as handle:
            created = True
            write_audio(handle, data, samplerate, format="WAV", subtype="FLOAT")
    except BaseException:
        if created:
            destination.unlink()
        raise


def parse_arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True, type=absolute_path)
    parser.add_argument("--input", required=True, type=absolute_path)
    parser.add_argument("--output", required=True, type=absolute_path)
    parser.add_argument("--log-dir", required=True, type=absolute_path)
    return parser.parse_args(argv)


def run(args):
    # The pinned legacy TensorFlow runtime was validated on CPU.
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "4")
    os.environ.setdefault("TF_NUM_INTEROP_THREADS", "2")

    import numpy as np
    import soundfile as sf

    if path_exists(args.output):
        raise FileExistsError('Refusing to overwrite: {}'.format(args.output))
    repository = args.repository.resolve()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    log_dir = args.log_dir.resolve()
    inference_path = repository / "inference.py"
    required_files = (
        inference_path,
        repository / "unet.py",
        repository / "conf" / "conf.yaml",
        repository / "experiments" / "trained_model" / "checkpoint.index",
        repository / "experiments" / "trained_model" / "checkpoint.data-00000-of-00001",
    )
    for required in required_files:
        if not required.is_file():
            raise ValueError("Missing official model file: {}".format(required))
    if not input_path.is_file():
        raise ValueError("Input file does not exist: {}".format(input_path))
    if output_path.suffix.lower() != ".wav":
        raise ValueError("Output must have a .wav extension.")
    if is_inside(log_dir, repository) or is_inside(output_path, repository):
        raise ValueError("Output and log directory must be outside the source repository.")
    if output_path == input_path:
        raise ValueError("Output must differ from the input file.")

    info = sf.info(str(input_path))
    if info.format not in ("WAV", "WAVEX"):
        raise ValueError("Input must be a WAV file.")
    if info.samplerate != 44100 or info.channels not in (1, 2) or info.frames <= 0:
        raise ValueError("Input must contain nonempty 44.1 kHz mono or stereo audio.")

    routes = {
        input_path.stem + "_denoised.wav": output_path,
        input_path.stem + "_noisy_input.wav": None,
        input_path.stem + "_residual.wav": None,
    }
    transport_path = log_dir / "historical-transport.json"
    destinations = [path for path in routes.values() if path is not None] + [transport_path]
    if len(set(destinations)) != len(destinations):
        raise ValueError("Output must not collide with a sidecar file in the log directory.")
    for destination in destinations:
        if path_exists(destination):
            raise FileExistsError("Refusing to overwrite: {}".format(destination))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    original_write = sf.write
    records = {}

    def write_float(filename, data, samplerate, *positional, **keywords):
        # Routing and PCM transport are the only changes to official inference.
        filename = Path(filename).name
        if filename not in routes:
            raise ValueError("Unexpected official inference output: {}".format(filename))
        if positional or keywords:
            raise ValueError("Unexpected SoundFile options from official inference.")
        if samplerate != 44100 or np.ndim(data) != 1 or len(data) != info.frames:
            raise ValueError("Official output has an unexpected shape or sample rate.")
        if not np.isfinite(data).all():
            raise ValueError("Official inference produced non-finite samples.")
        destination = routes[filename]
        peak = float(np.max(np.abs(data)))
        if destination is not None:
            write_float_exclusive(original_write, destination, data, samplerate)
        records[filename] = {
            "path": str(destination) if destination is not None else None,
            "written": destination is not None,
            "sample_rate": samplerate,
            "channels": 1,
            "frames": len(data),
            "duration_seconds": len(data) / samplerate,
            "subtype": "FLOAT",
            "peak_before_transport": peak,
        }
        action = "Wrote FLOAT WAV: {}".format(destination) if destination is not None else "Discarded intermediate"
        print("{} (peak {:.9f})".format(action, peak), flush=True)

    previous_cwd = Path.cwd()
    previous_argv = sys.argv[:]
    previous_path = sys.path[:]
    try:
        sf.write = write_float
        sys.path.insert(0, str(repository))
        os.chdir(str(repository))
        sys.argv = [
            str(inference_path),
            "inference.audio={}".format(input_path.as_posix()),
            "hydra.run.dir={}".format(log_dir.as_posix()),
        ]
        runpy.run_path(str(inference_path), run_name="__main__")
    finally:
        sf.write = original_write
        os.chdir(str(previous_cwd))
        sys.argv = previous_argv
        sys.path[:] = previous_path

    if set(records) != set(routes):
        raise RuntimeError("Official inference did not write every expected WAV output.")
    report = {
        "repository": str(repository),
        "tested_repository_commit": TESTED_REPOSITORY_COMMIT,
        "input": str(input_path),
        "transport_change": "FLOAT WAV denoised output; noisy-input and residual sidecars validated but not retained",
        "outputs": records,
    }
    with transport_path.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    return report


def main(argv=None):
    args = parse_arguments(argv)
    try:
        run(args)
    except (OSError, ValueError, RuntimeError) as error:
        print("Historical denoising failed: {}".format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

