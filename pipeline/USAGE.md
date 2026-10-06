# Audio and MP4 pipeline

Run these commands from the Arioso project directory in PowerShell. The launcher requires Python 3.12 or newer. Setup uses `uv` to install a separate Python 3.8 environment for the historical model; it does not change the project Python environment.

```powershell
# One-time setup; rerunning it checks and reuses the installed runtime.
.\pipeline\setup.ps1
.\pipeline\run.ps1 doctor

# Denoise and create a video. Omit --cover to use a plain background.
.\pipeline\run.ps1 run "path\track.mp3" --cover "path\cover.png"

# Run either step independently.
.\pipeline\run.ps1 denoise "path\track.mp3" -o "path\clean.wav"
.\pipeline\run.ps1 mp4 "path\clean.wav" --cover "path\cover.png" -o "path\video.mp4"

# Create a video without the historical denoiser; preserve the audio channels.
.\pipeline\run.ps1 run "path\track.mp3" --skip-denoise
```

Each combined run creates a new directory under `outputs/pipeline/` containing the WAV, MP4, intermediate audio, logs, and a checksum manifest. Use `--output-dir "path\new-run"` to choose a different new directory. Existing output files or run directories are refused. Input files are preserved.

The selected denoiser is [denoising-historical-recordings](https://github.com/eloimoliner/denoising-historical-recordings), pinned to commit `114fce7c849c5c5ed9c1c69bdb1610a5b949796b`. It averages stereo input into **mono** and runs at 44.1 kHz on CPU. The pipeline keeps its inference code unchanged, transports the denoised output as FLOAT WAV to avoid premature clipping, and applies only a constant reduction in gain when needed for peak headroom. Decoded, raw-denoised, noisy-input, and residual WAV intermediates are not retained after a successful export. The final audio is 24-bit WAV.

Videos contain a static cover or plain background at 1920 x 1080, with H.264 video and AAC audio at 192 kb/s. Covers are fitted without stretching. MP4 audio is compressed again; keep the WAV as the audio master.

Scripts live in `pipeline/`. Downloaded dependencies and model files live in `pipeline/runtime/`. Setup records their absolute paths in `runtime.json`. If the project moves, recreate the virtual environment with setup at the new location; virtual environments contain absolute interpreter paths. To choose another runtime location, use `setup.ps1 -RuntimeDir "path\runtime"`, then pass `run.ps1 --config "path\runtime\runtime.json"` before the subcommand. `setup.ps1 -FfmpegPath "path\ffmpeg.exe"` selects an existing FFmpeg binary with `libx264` and `aac` encoders. Setup also requires Git.

To process a complete numbered MP3 album and make one video:

```powershell
.\pipeline\run.ps1 album "path\tracks" --title "Studying in the Dark" --cover "path\cover.png"
```

Album mode processes every track, in numeric filename order, with the historical model only. It uses the same constant gain for every cleaned track to preserve their relative levels, and joins them without adding gaps or crossfades. It keeps each cleaned WAV, the complete album WAV, and a chapter-style track list (`MM:SS Title`, separated by blank lines; hour-long albums use `HH:MM:SS`). When `--cover` is provided it also creates and verifies an MP4; without a cover, successful audio processing ends normally without a video. Two CPU workers are used by default; pass `--workers 1` to run sequentially. Existing output directories are refused unless `--resume` is supplied. Resume mode verifies source identities and per-track checksums, reruns only missing or invalid denoising/export work, and creates the album and optional MP4 only after every cleaned track passes validation.

The Arioso task workflow passes an ordered JSON source manifest and writes the pipeline result directly to the task's `production/<run-id>/` directory. The manifest references the task's existing MP3 files, so production does not create a second copy of every source track.
