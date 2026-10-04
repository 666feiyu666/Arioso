# Studying in the Dark: experiment report

The completed album contains 14 instrumental candidates, totalling **2049.57 seconds (34:09.57)**. The persisted task snapshot and current application mark all 14 tracks as included; that existing state is retained in this archive.

## Theme and author decisions

The requested theme was neoclassical music for studying with a dark academia atmosphere. The user's selected mood can be paraphrased in English as calm and slightly melancholic, like reading in an old library late at night; the original Chinese wording is retained in [the concept record](../inputs/album-concept.md).

The submitted working direction used acoustic piano and intimate chamber strings, restrained dynamics, varied instrument interaction, and gradual harmonic or motivic development. The [plan](plan.json) records the generated album mind, cohesion strategy, shared sound contract, and individual track roles.

## Review and revision

The [initial review](initial-review.json) requested revisions to candidates 12 and 14. The [observed pre-repair task](observed-before-repair-task.json) supplies their actual earlier specs. Candidate 12's repair reduced repeated production exclusions; candidate 14's repair made its slow closing transformation more explicit.

The [final review](final-review.json) retained `needs-work` judgments for candidates 13 and 14, principally concerning their similarity to earlier tracks and repeated production wording. These are retained editorial findings for listening and selection. The review JSON is preserved as reviewer output, rather than treated as a listening verdict.

The first final-review attempt returned inconsistent overall/per-candidate verdicts and failed validation. Retrying the existing task resumed final review and then completed generation. The rejected response was not persisted.

The [revision comparison](revision-comparison.json) identifies changed fields from the real observed versions:

- Track 12: [before](initial/12.json) / [after](final/12.json).
- Track 14: [before](initial/14.json) / [after](final/14.json).
- The other 12 MusicSpecs are identical between the observed initial and final states.
## Candidate tracks

| No. | Title | Planned seconds | Actual seconds | Final spec | Rendered prompt |
|---|---|---:|---:|---|---|
| 1 | Dusk at the Reading Room | 150 | 148.53 | [Spec](final/01.json) | [Prompt](final/01.prompt.txt) |
| 2 | Dust in the Lamplight | 135 | 126.48 | [Spec](final/02.json) | [Prompt](final/02.prompt.txt) |
| 3 | First Margins | 140 | 141.77 | [Spec](final/03.json) | [Prompt](final/03.prompt.txt) |
| 4 | The Long Table | 165 | 165.36 | [Spec](final/04.json) | [Prompt](final/04.prompt.txt) |
| 5 | Index of Shadows | 145 | 142.00 | [Spec](final/05.json) | [Prompt](final/05.prompt.txt) |
| 6 | Between Shelves | 155 | 156.89 | [Spec](final/06.json) | [Prompt](final/06.prompt.txt) |
| 7 | A Page Turned Slowly | 130 | 131.47 | [Spec](final/07.json) | [Prompt](final/07.prompt.txt) |
| 8 | Midnight Concordance | 175 | 172.85 | [Spec](final/08.json) | [Prompt](final/08.prompt.txt) |
| 9 | Marginalia in Blue | 125 | 120.95 | [Spec](final/09.json) | [Prompt](final/09.prompt.txt) |
| 10 | The Clock Without Hands | 150 | 157.20 | [Spec](final/10.json) | [Prompt](final/10.prompt.txt) |
| 11 | Quiet Corrections | 135 | 137.33 | [Spec](final/11.json) | [Prompt](final/11.prompt.txt) |
| 12 | The Lower Gallery | 180 | 174.52 | [Spec](final/12.json) | [Prompt](final/12.prompt.txt) |
| 13 | Last Notes Before Closing | 120 | 115.15 | [Spec](final/13.json) | [Prompt](final/13.prompt.txt) |
| 14 | Lights Out in the Library | 165 | 159.06 | [Spec](final/14.json) | [Prompt](final/14.prompt.txt) |

## Validation and media

- All 14 individual files and the full candidate MP3 passed complete FFmpeg decoding during the original generation checks, with exit code 0 and no error output.
- All 14 single-track audio endpoints returned HTTP 200 with non-empty `audio/mpeg` content.
- Archive validation checks numbering, instrumental mode, the captured admission state, request/task identity, retained audio references, and explicit quality directions in the actual prompts. Original completion checks observed 14 candidates; the archive captures their later included state.
- [Audio manifest](audio-manifest.json) records relative source paths, durations, file sizes, and SHA-256 hashes. Audio remains in the product task's outputs directory.
- [Full candidate MP3](../../../outputs/tasks/04-album/c92f722d-2212-4e82-9499-178b479b552f/exports/1df74b1904d4736443d4a352ef5f52d71f075e438ada2f606211ef1626d99a77.mp3).
- [Track timestamps](<../../../outputs/tasks/04-album/c92f722d-2212-4e82-9499-178b479b552f/exports/Studying in the Dark - Candidates - Timestamps.txt>).
- [Open Arioso](http://127.0.0.1:4173/) and select **04 Album and playlist** to listen and decide admission.

## Archive provenance

This folder was assembled from the exact submitted request, persisted completed task, and a real pre-repair task observation retained during this chat. The original Chinese concept record was moved with its language preserved and media links updated. Metadata retains the source task timestamps and models.

Initial and final spec files represent observed task states. Exact per-call instruction payloads, raw composer responses, rejected review JSON, and run checkpoints were not captured. File decoding establishes media integrity; sound quality and study suitability remain listening decisions.