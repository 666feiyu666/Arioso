# DH6012 End-to-End Evaluation Plan

## Status

This document defines the evaluation protocol. It does not yet contain results.

## Evaluation purpose

The evaluation asks whether the complete Arioso workflow produces music that better satisfies a user's underlying emotional need than sending the user's first short request directly to the same music-generation model.

The comparison is deliberately end to end. Arioso includes poetry retrieval, conversation, the Prompt Director, the structured Composer, the current music-reference setting, and Lyria generation. The study does not attempt to remove RAG or attribute an improvement to any single component.

## Research question

> Given the same brief initial expression of mood, does the complete Arioso workflow produce music that listeners judge as more appropriate to the user's current emotional state and more effective at meeting the user's intended outcome than direct single-prompt generation?

## Compared conditions

### Condition A: direct-generation baseline

```text
Initial user message
-> the same Lyria generation model
-> baseline audio
```

The baseline receives only the exact initial message listed for the scenario. Instrumental mode is held constant across both conditions.

### Condition B: complete Arioso workflow

```text
The same initial user message
-> poetry retrieval
-> bounded conversation
-> Prompt Director brief
-> Composer and validated MusicSpec
-> current automatic music-reference behaviour
-> the same Lyria generation model
-> Arioso audio
```

The first valid Director brief and the first successful audio generation are used. The evaluator does not edit the brief, edit the `MusicSpec`, select among several takes, or regenerate because of the automatic listening review. The review result is retained as evidence but does not determine which audio enters the study.

## Evaluation scenarios

The four scenarios correspond to MoodMic's four energy-and-pleasantness groups. Each begins with a deliberately incomplete request. The hidden need supplies only the answers that the simulated user may reveal during conversation.

| Mood group | Exact initial message | Predefined underlying need |
|---|---|---|
| Red: high energy, unpleasant | `我现在很焦虑，想听点纯音乐。` | The user is about to give an important presentation. They want to settle their breathing and regain focus without becoming sleepy or losing alertness. |
| Yellow: high energy, pleasant | `我现在很兴奋，想听点纯音乐。` | The user has completed an important project. They want to sustain joy and a sense of achievement without the music becoming chaotic, noisy, or overstimulating. |
| Blue: low energy, unpleasant | `我现在很疲惫，想听点纯音乐。` | The user must continue working for another hour. They want to recover energy and concentration gently, without becoming sleepier or being confronted by sudden intensity. |
| Green: low energy, pleasant | `我现在很平静，想听点纯音乐。` | The user is preparing to read before sleep. They want to preserve a calm, comfortable state, with subtle development but no dramatic climax or tension. |

These cases test four different functions of mood-aware music: reducing unpleasant high energy, sustaining pleasant high energy, improving unpleasant low energy, and preserving pleasant low energy.

## Conversation protocol

The Arioso condition may use no more than three additional user turns after the initial message.

The evaluator acts as the user and follows these rules:

1. Answer only with information contained in the scenario's predefined underlying need.
2. When asked for an unspecified musical or technical preference, answer: `我没有具体的音乐偏好，请根据这个需求决定。`
3. When several options satisfy the scenario equally well, select the first option presented.
4. Do not introduce new instruments, genres, imagery, duration requirements, or production preferences.
5. Accept the first complete Director brief without editing it.

The complete transcript, retrieved poem references, retrieval trace, approved brief, `MusicSpec`, and final Lyria prompt must be retained with the run record.

## Generation protocol

For each scenario, generate one baseline audio file and one Arioso audio file.

- Use the same Lyria model for both conditions.
- Use instrumental mode for both conditions.
- Keep Arioso's current retrieval behaviour and default music-reference setting.
- Use the first successful generation in each condition; do not choose the better of several takes.
- Do not impose or equalise duration, and do not trim either result.
- Record the natural duration as an observed output.
- Apply the same playback format and volume handling to both files.
- Preserve provider, model, prompt, schema, corpus, and application versions where available.
- Record failures rather than silently replacing a failed run with an unreported attempt.

This produces four blinded pairs and eight audio files in total.

## Blind listening protocol

Each pair receives neutral identifiers such as `A` and `B`. The mapping between identifiers and conditions is randomised independently for each scenario. Listening order is also randomised, and filenames or metadata must not reveal the condition.

Listeners are shown:

- the exact initial user message; and
- the predefined underlying need.

They are not shown the conversation, retrieved references, Director brief, `MusicSpec`, Lyria prompt, automatic review, or condition identity.

Each listener answers the following questions for every pair:

1. **Emotional-state fit:** How appropriate is each piece for the user's current emotional state? Rate each piece from 1 to 5.
2. **Need fulfilment:** How well does each piece help the user reach the intended outcome? Rate each piece from 1 to 5.
3. **Retention choice:** If you were this user, which piece would you keep? Choose `A`, `B`, or `No clear difference`.
4. **Reason:** Give one optional short reason for the choice.

Need fulfilment is the primary measure. Emotional-state fit and retention choice provide supporting evidence.

## Participants and workload

The minimum planned study is:

- four scenarios;
- one blinded pair per scenario;
- eight to twelve listeners; and
- all four pairs evaluated by every listener.

This is a small comparative study intended to provide descriptive evidence for the course project. It is not powered for broad statistical generalisation.

## Run record

Each generated item should retain at least:

- scenario and condition identifiers;
- exact initial input;
- full Arioso transcript when applicable;
- retrieved reference identifiers and corpus versions when applicable;
- approved Director brief when applicable;
- validated `MusicSpec` and final Lyria prompt when applicable;
- provider and model identifiers;
- generation timestamp, attempt number, and failure history;
- audio filename, duration, and checksum;
- automatic review output when applicable; and
- the concealed A/B mapping used for the listening study.

Listener responses should use anonymous listener identifiers and record scenario, presentation order, ratings, retention choice, and optional reason.

## Analysis

Report the following for each scenario and across all four scenarios:

- mean emotional-state-fit rating by condition;
- mean need-fulfilment rating by condition;
- counts of baseline wins, Arioso wins, and no-clear-difference choices; and
- recurring themes in listeners' written reasons.

Results should be interpreted descriptively. The analysis should discuss whether Arioso's advantage, if any, appears in understanding the requested emotional transition, musical coherence, restraint, energy management, or another repeated listener observation.

Actual duration, generation failures, latency, and model-call counts may be reported as system trade-offs, but duration is not a controlled variable in this study.

## Interpretation boundaries

This evaluation supports a claim about the complete user-facing Arioso workflow relative to direct single-prompt generation. It does not separately establish the contribution of poetry retrieval, music-corpus retrieval, conversation, the Director, the Composer, schema validation, or the automatic reviewer.

With four generated pairs, the study is a bounded end-to-end comparison rather than a general benchmark. Stochastic generation, uncontrolled duration, the small listener group, and the use of one generated pair per scenario must be reported as limitations. No result should be presented as proof that automated checks establish musical or therapeutic quality.
