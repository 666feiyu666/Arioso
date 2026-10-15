# Standalone Music Defect Assessment Workflow

## Objective and Scope

Build a standalone workflow that accepts generated music in MP3 or WAV format, calls Google's Gemini API to identify audible defects, reports their approximate locations, and decides whether another generation should be requested.

The workflow must run without Arioso, its server, task records, storage, or imports. It does not repair audio, train a detection model, evaluate artistic quality, or generate music itself. An external caller supplies each audio candidate and acts on the returned decision. Each creation request permits at most three generations, including the first.

## Implementation Boundary

Use Python, LangGraph, and Google's official `google-genai` SDK in a separate package with its own dependencies, configuration, and tests. Provide a command-line entry point and a callable assessment function. No frontend is required.

Read `GEMINI_API_KEY` from the environment. Configure the model through `GEMINI_MODEL`; select and verify a model supporting both audio input and structured output. Record the resolved model and assessment-prompt version in every report. Never include credentials in reports or logs.

Google documents MP3 and WAV audio input and timestamp-based analysis in its [audio understanding guide](https://ai.google.dev/gemini-api/docs/audio). Use its [structured output support](https://ai.google.dev/gemini-api/docs/structured-output) for machine-readable findings, followed by local validation.

## Input Contract

- `audio_path`: Local path to one MP3 or WAV file.
- `request_id`: Stable identifier shared by all candidates for the same creation request.
- `generation_attempt`: Integer from 1 to 3; default 1 for standalone inspection.
- `intentional_effects`: Optional brief description of deliberate effects, such as vinyl crackle or distorted guitar.
- `report_path`: Optional destination for a JSON report; otherwise return JSON through standard output.

Validate file existence, actual format, successful decoding, nonzero duration, and applicable API size and duration limits before upload. Map MP3 to `audio/mp3` and WAV to `audio/wav`. Preserve the original file without denoising, normalising, or trimming it.

## LangGraph Flow

Use a short graph: **Validate input → Assess audio → Validate response → Decide → Report**. Validation or API failures lead to an error report.

Upload the audio through Google's Files API, wait until it is ready, and send the complete recording with the assessment prompt and response schema. Use one assessment call per candidate; omit chunking, separate judges, and repair stages in the initial version. Reject oversized inputs explicitly rather than inspecting only part of them. Delete the temporary remote upload after assessment, including failure paths where possible.

Keep graph state limited to input metadata, duration, attempt number, model findings, final decision, and errors.

## Assessment Instructions

Ask the model to inspect the entire recording for clearly audible, unintended defects: isolated clicks or pops, harsh digital noise, broken or corrupted sound, unnatural dropouts, and abrupt audio discontinuities.

Exclude judgments about genre, melody, harmony, mood, or personal preference. Do not flag normal percussion transients, jazz dissonance, intentional pauses, or declared production effects merely because they sound unusual. Report only clearly supported defects; an ambiguous sound alone should not trigger rejection.

For each defect, return a start time, end time, defect type, and short description of the audible evidence. Times are seconds from the beginning of the original file, including leading silence. They are estimates, not sample-accurate measurements. Return `has_defect: false` with an empty findings list when no clear defect is detected. An unreadable or unassessed recording must produce an error, never a clean result.

## Output and Decision Contract

The following is an illustrative report, not a measured result:

```json
{
  "request_id": "example-001",
  "generation_attempt": 1,
  "assessment_status": "completed",
  "has_defect": true,
  "defects": [
    {
      "start_seconds": 42.1,
      "end_seconds": 43.0,
      "type": "digital_noise",
      "description": "A brief harsh crackle interrupts the music."
    }
  ],
  "timestamps_are_approximate": true,
  "should_regenerate": true,
  "decision": "regenerate",
  "reason": "An audible defect was detected; another attempt is allowed."
}
```

Also include the input filename, duration, model, prompt version, and assessment time. Validate that every interval satisfies `0 <= start_seconds < end_seconds <= duration_seconds`. Reject inconsistent findings, missing fields, and invalid timestamps rather than silently treating them as success.

Compute decisions in application code, not in the model:

| Condition | Decision | Should regenerate |
| --- | --- | --- |
| No defects detected | `accept` | `false` |
| Defects detected, attempt 1 or 2 | `regenerate` | `true` |
| Defects detected, attempt 3 | `stop_limit_reached` | `false` |
| Invalid input, API failure, or invalid response | `error` | `null` |

For errors, use `assessment_status: "error"` and `has_defect: null`. At the generation limit, retain `has_defect: true`; stopping does not mean the audio passed.

## Caller Behaviour and Verification

On `regenerate`, the caller generates a new candidate using the unchanged creative request, increments the attempt, and submits it again. Preserve earlier audio and reports. The caller owns the attempt counter and must never request a fourth generation. Assessment retries do not count as music generations; bound transient API retries to two additional calls.

Verify MP3/WAV ingestion, valid and invalid timestamps, all decision branches, error handling, and the three-generation limit. Include human-checked clean recordings, obvious defect examples, and intentional effects. Compare reported locations with known locations and document false positives and misses. Passing means no clear defect was detected, not guaranteed defect-free audio.
