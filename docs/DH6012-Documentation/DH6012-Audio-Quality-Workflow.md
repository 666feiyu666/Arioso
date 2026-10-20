# Audio quality: what exists and what is planned

This document says what audio-quality checking is already in Arioso and what is still to come. It describes behaviour and boundaries, not implementation.

## Implemented: the listening review

MoodMic already checks the music it makes. After Lyria returns audio for a piece, Gemini listens to the recording and compares it with the request the user approved: the prompt and the structured music specification written for that piece. It answers with a verdict, a short summary, what matched, and what did not.

The verdict decides what the interface does next.

- When the piece broadly matches the request, it is delivered with the result card.
- When it clearly misses the request, the piece is held. The user hears it, reads the summary and the points that disagreed, and chooses to regenerate or keep it.
- When the review cannot run at all, the piece is delivered unchanged and the result says the check did not run.

What this covers: whether one generated piece does what the user asked for. What it does not cover: audible defects in the audio, artistic quality, or anything outside the single-piece MoodMic flow. The feature is described in DH6012-MoodMic-Detailed.md.

## Planned: standalone defect assessment

The missing capability is an assessment of the audio itself, usable on its own and outside Arioso.

It should take a generated MP3 or WAV recording and answer three things: whether the recording contains clearly audible, unintended defects; roughly where in the recording they are; and whether the caller should generate another candidate. One creation request may produce at most three candidates, including the first, and reaching that limit stops the loop without meaning the audio passed.

Defects here mean damage rather than taste: clicks and pops, harsh digital noise, broken or corrupted sound, dropouts, and abrupt discontinuities. Normal percussion transients, jazz dissonance, intentional pauses, and declared production effects are not defects just because they sound unusual.

The assessment should run without Arioso's server, task records, storage, or imports. An external caller supplies the audio and acts on the answer. It should not repair audio, train a detection model, judge artistic quality, or generate music.

The result has to keep three outcomes separate: no clear defect found, defects found, and the recording could not be assessed. A file that cannot be assessed is an error, never a clean result.

## Out of scope

- Noise cancellation and mastering, which stay as later production stages after generation.
- Automatic repair of whatever the assessment finds.
