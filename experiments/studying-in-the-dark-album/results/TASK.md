# Studying in the Dark: album generation task

This experiment archives the completed Arioso album task `c92f722d-2212-4e82-9499-178b479b552f`.

## Submitted request

The exact submitted body is retained in [album-request.json](../inputs/album-request.json). The original Chinese request, the user's mood selection, and the distinction between user choices and proposed arrangements are retained in [album-concept.md](../inputs/album-concept.md).

```json
{
  "description": "Create a new instrumental neoclassical album titled Studying in the Dark. Theme: studying alone late at night in an old library, with a dark academia atmosphere. The listener has chosen a calm, slightly melancholic mood. Interpret neoclassical here as contemporary acoustic piano and intimate chamber music, with melodic clarity, restrained counterpoint, repeating figures and subtle harmonic evolution. The primary purpose is sustained reading and study.\n\nAlbum mind: moving from arrival at an old library after dusk, into sustained concentration, through a deeper reflective middle, toward a quiet late-night close. Let darkness emerge through lower registers, minor and modal colors, suspended resolutions and gently moving inner voices. Keep the feeling contemplative, composed, solitary and quietly humane. Dynamics and transitions should support uninterrupted study. Give every piece its own gentle entrance, meaningful small-scale development and softened ending.\n\nLet the album composer choose and explain its own cohesion strategy. Piano is the main anchor, with selected cello, viola and small chamber-string combinations. Some tracks can be solo piano; others can be duets or small chamber pieces. Across 14 candidates vary foreground voice, instrument interaction, pulse or meter, articulation, register, harmonic rhythm, motif shape and development method. Each track needs an audible identity beyond a different name, key or tempo. Maintain continuity with controlled dynamics, modest ensemble scale and related harmonic sensibility. Subtle tension and release are welcome within the calm mood. Avoid busy virtuosity, forceful dramatic climaxes, large orchestral swells, sudden accents, heavy percussion, suspense or horror effects.\n\nUse acoustic musical sound without environmental sound layers: no rain recordings, page rustling, library foley, vinyl crackle or deliberately noisy lo-fi texture. Piano should have a clear, gently rounded tone with restrained upper-register brightness and natural decay. Strings should be smooth and softly articulated, without abrasive bow effects. Use a coherent intimate acoustic space with restrained natural room reverberation and clear instrumental separation.\n\nMandatory audio quality requirement for every candidate: Clean studio recording, natural acoustic timbres, smooth transients and controlled peaks. No clipping, crackling or digital distortion. Put these instructions into the shared sound contract and every actual audio-generation prompt, with appropriate production and avoid fields; do not leave them only in the album rationale.\n\nInstrumental only: no singing, humming, spoken words or choir. Generate 14 complete, self-contained candidate pieces, each approximately 60 to 180 seconds with at least three distinct intended durations. Aim at approximately 35 minutes across the candidates, allowing natural variation in length. Review the complete candidate prompt set for theme fit, study suitability, meaningful musical differences, playable development and audio-quality requirements; revise concrete problems before audio generation. Retain all generated pieces as candidates for the user's listening and admission decisions. Use English titles and music-generation prompts.",
  "mode": "generate",
  "workflowType": "04-album",
  "compositionMode": "album",
  "vocalMode": "instrumental",
  "corpusMode": "none",
  "candidateCount": 14,
  "targetTotalMinutes": 35,
  "lyriaModel": "lyria-3.5"
}
```

## Execution and review

The existing product album workflow planned the album, composed all 14 candidate MusicSpecs, reviewed their rendered prompts together, revised candidates 12 and 14, and performed a final review. The first final-review attempt failed verdict-consistency validation; continuing the same task preserved its existing plans and revisions and requested final review again. The completed prompts were then sent to Lyria and all generated audio remained candidate material.

- Actual composer model: `gpt-5.6-luna`.
- Actual music model: `lyria-3.5`.
- Planned duration range: 60–180 seconds per candidate; target batch approximately 35 minutes.
- Audio-quality directions were included in the submitted request, shared sound contract, and actual final prompts.
- Runtime implementation reference: [album task flow](../../../src/web/server.ts), [album agents](../../../src/composer/album-agent.ts). These references point to project code; exact per-call runtime instruction payloads were not captured.

## Retained evidence

- [Observed task before repair](observed-before-repair-task.json): a real GET observation containing all 14 initial specs after first review and before repair; provenance is stored with the snapshot.
- [Initial review](initial-review.json) and [final review](final-review.json): the reviews persisted by the product task.
- `initial/NN.json` and `initial/NN.prompt.txt`: specs and rendered prompts extracted from that observed pre-repair snapshot.
- `final/NN.json` and `final/NN.prompt.txt`: exact final specs and rendered prompts extracted from the completed task.
- [Completed task snapshot](task-snapshot.json), [plan](plan.json), [audio manifest](audio-manifest.json), and [validation](validation.json).

The observation archive preserves available execution evidence. Per-call composer inputs, raw model responses, the rejected final-review JSON, and original run checkpoints were not persisted by the product task.