# Background Music Producer

This optional album workflow owns production from an instrumental brief through
planning, composition, prompt review and revision, Lyria generation, historical
denoising, album assembly, and verified delivery. Audacity integration is deferred.
The existing album author, composer, and reviewer retain their musical roles.

In the browser, open **Albums**, create an album, and select **Background Music
Producer · generate and denoise** under **Production workflow**. The existing
candidate-only workflow remains available. The producer checks the installed
audio runtime before making composition or generation requests.

```powershell
pnpm dev produce-album "Instrumental background music for quiet nighttime reading"
pnpm dev produce-album --resume "<failed-task-id>"
```

The same mode is available through `POST /api/tasks` with
`workflowType: "04-album"` and `produceAlbum: true`. Existing album duration and
candidate-count settings apply (12–15 candidates; 30–40 target minutes).

## Existing audio pipeline

Configure and check the installed pipeline using `pipeline/setup.ps1` and
`pipeline/run.ps1 doctor`; see [pipeline usage](../pipeline/USAGE.md).
`ARIOSO_PIPELINE_PYTHON` can select the launcher interpreter, and
`ARIOSO_PIPELINE_CONFIG` can select a different runtime JSON file. Otherwise the
producer uses `python` and the pipeline's existing default runtime configuration.
Commands use an argument array without shell interpolation.

The current denoiser averages stereo to **mono**, runs at 44.1 kHz on CPU,
and exports 24-bit WAV. It processes all non-excluded generated candidates in
their original numbered order. It preserves their relative levels using one
constant attenuation for peak headroom; this is not loudness normalization.
The workflow does not measure whether denoising improves musical quality.
Compare originals and cleaned audio before admitting tracks to a final playlist.
Candidate admissions and playlist order are not changed automatically.

## Delivery and recovery

Each task keeps the original MP3 files. Production attempts have separate UUID
directories under the task's `production/` directory, containing source checksums,
numbered staging copies, a plain video background, pipeline logs, per-track cleaned
WAV files, the complete album WAV, MP4, timestamps, and the pipeline manifest.
Checks verify source preservation, cleaned track and master checksums, nonempty
exports, expected PCM format, and the sum of track durations before completion.

The task stores the producer role, current stage, progress, output attempt,
and errors. Listening review remains pending after technical completion.
A failed postproduction run can be retried from the task's existing Continue
button or the CLI. Already completed generated candidates are reused, avoiding
new Lyria requests; an incomplete processing attempt is retained and a new
attempt is created. Browser server restarts mark interrupted tasks failed.

Completed task pages provide a denoised master preview and downloads. Artifact
routes are `GET /api/tasks/<task-id>/production/audio`, `/video`, `/tracklist`, and
`/manifest`; they resolve only fixed files inside the saved production attempt.
