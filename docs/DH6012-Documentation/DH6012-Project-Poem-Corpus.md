# DH6012 Project Refinement: Poetry-Informed Prompt Director

## 1. Objective

This refinement uses the existing modern Chinese poetry corpus to improve `prompt-directing-skill`. Its primary goal is to make the Director's conversation and creative description more specific, image-rich, and emotionally attentive before the Composer designs the music.

After the user settles the direction, the Director should produce a two-paragraph creative brief: first a developed creative description, then the agreed musical direction and constraints. The Composer translates that description into musical decisions. Increasing the description's substance and preserving the Composer's design space are the main goals of this revision.

The poems belong to the Director boundary:

- the Director reads retrieved poems while exploring the creative direction and recording musical preferences;
- the user reviews and may edit the Director's final brief;
- the Composer receives only the approved brief, not the poems;
- the existing `MusicSpec`, music-corpus retrieval, Lyria, review, and journey responsibilities remain separate.

Poetry retrieval is deterministic support for one existing agent. It does not introduce another agent, a vector database, or a fixed emotion-to-poem ontology.

### 1.1 Current implementation and proposed change

The repository review on 21 October 2026 found that MoodMic already supplies poem references before discussion replies and proposal generation. Query construction, reference reuse, mood-vocabulary expansion, and a minimum relevance filter are implemented. Their behavioural and quality requirements remain documented below.

The remaining brief-design problem is visible in the current instructions:

- `references/proposal.md` restricts the creative opening to one or two sentences, then requires instrumentation, register, harmony, development, and ending in the same paragraph.
- `src/discussion/langchain-discussion.ts` reinforces a concise final prompt and describes the discussion output and mood imagery in musical terms.
- The approved proposal reaches the Composer as one description. This handoff does not separately identify the user's choices and musical choices introduced by the Director.

These instructions can compress the creative description and settle musical decisions before the Composer receives the request. The two-paragraph contract below is the proposed correction. This document does not claim that the revised prompts, interface wording, or Composer instructions have been implemented or that audio quality has improved.

## 2. Target Workflow

```text
User message
  -> retrieve up to three relevant poems immediately
  -> Director reads the poems and replies naturally
  -> conversation settles creative intent and explicit musical preferences
  -> retrieve again when the effective user context has changed
  -> Director writes a two-paragraph creative brief:
       1. creative description
       2. agreed musical direction, constraints, and open choices
  -> user confirms or edits the brief
  -> Composer reads the approved brief and explicit application settings
  -> Composer designs the musical realization
  -> MusicSpec -> Lyria prompt -> music generation
```

Retrieval should therefore support both `DiscussionAgent.respond()` and `DiscussionAgent.propose()`.

The final proposal step does not always require a duplicate search. If the user-authored context and structured mood are unchanged since the latest retrieval, the application should reuse that result. If either has changed, it should run retrieval again before calling `propose()`.

## 3. Role Boundaries

### 3.1 Poetry retriever

The retriever selects reference material. It does not decide what the user feels, write a response, or map an image directly to an instrument.

Its output is at most three complete poems with IDs, titles, authors, scores, and matched terms.

### 3.2 Prompt Director

The Director:

- listens for feeling, setting, purpose, constraints, and desired emotional movement;
- uses poems for imagery, atmosphere, rhythm, motion, contrast, repetition, and emotional development;
- responds like a perceptive creative collaborator rather than an emotion classifier or technical questionnaire;
- develops a creative description with enough substance to guide composition;
- records confirmed musical requirements separately from imagery and emotional movement;
- leaves unspecified musical decisions to the Composer rather than filling every gap;
- never quotes distinctive lines or imitates a named poet.

### 3.3 User

The user remains the authority on the direction. Both paragraphs are editable, and an edit overrides any conflicting implication taken from a poem. Confirmation settles the brief's intent and stated constraints; choices explicitly left open remain the Composer's responsibility.

### 3.4 Composer

The Composer receives the approved brief and the application's explicit settings. It does not receive poem text or perform poetry retrieval. It reads the first paragraph as creative intent and the second as musical requirements, preferences, and remaining freedom. Its responsibility is to design the instrumentation, instrument relationships, melody, harmony, rhythm, form, and development needed to realize that intent, then express the result as a coherent `MusicSpec` and production-ready Lyria prompt.

Explicit user choices remain binding wherever they appear. A requested instrument or melody characteristic must not be removed merely to make the first paragraph nontechnical. The Director should organize such choices into the second paragraph, and the Composer should preserve them. Unconfirmed suggestions must remain visibly optional; the Director must not present its own default ensemble or form as a user requirement.

The priority order is:

```text
explicit user requirements and authoritative application settings
  > user-approved or edited brief
  > Director's poetry-informed interpretation
```

## 4. Retrieval Contract

### 4.1 Query content

The retrieval query should contain:

```text
all user-authored messages up to the current turn
+ the latest structured mood label
+ the latest structured mood imagery
+ deterministic mood-lexicon expansions
```

"All user-authored messages" does not mean the raw full transcript. The query must exclude:

- Director replies;
- previously retrieved poem text;
- system and skill instructions;
- interface copy;
- generated proposals.

Excluding Director prose prevents the model's own invented imagery from dominating later searches.

On the first user turn there may be no stored Director mood. The raw message and mood lexicon must therefore be sufficient to form the query. Common user vocabulary such as `难过` should be included in the `sad` expansion group alongside `悲伤`, `哀愁`, `惆怅`, and related terms.

### 4.2 Ranking and result policy

The existing Chinese-aware TF-IDF approach remains sufficient:

- character bigrams and trigrams for Chinese text;
- weighted mood cues, titles, and full poem text;
- cosine similarity;
- deterministic ID-based tie breaking;
- at most three results;
- at most one result per author.

The retriever already applies a minimum relevance threshold. A weak overlap on a generic phrase such as `感到` must not be enough to supply a poem. The threshold should be evaluated and calibrated with a fixed evaluation set; its presence alone does not establish retrieval quality.

Complete poem text is passed to the Director in memory. Saved chat state records only query and reference metadata, not duplicate copies of the poems.

### 4.3 Reuse and invalidation

Each retrieval should be associated with a deterministic query hash and corpus version.

- Reuse the latest references when the query hash and corpus version are unchanged.
- Invalidate the proposal and its retrieval trace when the user adds another message.
- Replace the trace when a changed context produces a new proposal.
- If the corpus version changes, run retrieval again rather than silently reusing old IDs.

## 5. `prompt-directing-skill` Refinement

The main implementation work belongs in:

```text
skills/prompt-directing-skill/SKILL.md
skills/prompt-directing-skill/references/discussion.md
skills/prompt-directing-skill/references/proposal.md
```

### 5.1 Shared skill contract

`SKILL.md` should state that retrieved poems are optional reference data for the Director in both phases. The user's words remain authoritative. Poetry should enrich interpretation without becoming a performance of poetry or an attempt to sound like a specific poet.

The shared contract should distinguish a brief conversational reply from the developed creative brief produced after agreement. It should assign emotional and sensory elaboration to the Director, musical realization to the Composer, and require the final brief to separate creative description from musical direction in two paragraphs.

### 5.2 Discussion behaviour

`discussion.md` should require the Director to:

1. receive the current poetry references before replying;
2. begin with the user's emotional centre rather than a technical music question;
3. use no more than one clear sensory image in a short reply;
4. explore how the feeling moves, pauses, deepens, or changes;
5. ask at most one gentle question when it helps develop that emotional movement;
6. preserve musical details the user supplies, while avoiding unsolicited BPM, key, formal sections, and detailed instrumentation;
7. clarify broad musical preferences when useful, without turning agreement on an emotional direction into permission to settle an arrangement;
8. remain concise and conversational rather than ornate or theatrical;
9. never mention retrieval, similarity scores, or poem titles unless the user explicitly asks;
10. let direct safety language override the poetic conversational style when a message contains an explicit crisis or self-harm signal.

The target experience is a conversation with someone who has read poetry closely, not a chatbot that diagnoses emotion or recites poems.

For example:

```text
User: 感到很难过。

Director: 难过……像房间里的光一点点低下来，什么都还在，只是颜色轻了一层。你希望这首音乐陪着这份难过停一会儿，还是慢慢带你走出去？
```

If the user answers `就停一会儿吧`, the Director can continue the emotional direction before fixing technical details:

```text
那就让它在这里停一会儿。房间里的光继续暗下去，身边熟悉的东西仍在原处。这份难过可以慢慢沉下来，暂时不需要一个答案。
```

These examples demonstrate pacing and tone. They are not templates that must be repeated verbatim.

### 5.3 Proposal behaviour

`proposal.md` should require the Director to:

- synthesize the user-authored context, latest mood, and current poem references;
- preserve explicit purpose, constraints, scope, and edits;
- return two prose paragraphs separated by a blank line, in the user's language;
- develop the creative description before stating musical requirements;
- distinguish confirmed constraints, preferences, optional suggestions, and choices left to the Composer in ordinary language;
- produce a creative brief for the Composer rather than a final Lyria prompt;
- avoid quotations, poet names, source titles, retrieval commentary, and unsupported claims;
- drop any poem whose implications conflict with the user.

#### Paragraph 1: Creative description

Describe the experience the music should express: the specific quality of the feeling, a coherent setting or sensory image, its internal tension or stillness, how it changes or remains, and the feeling that should linger. Emotional movement need not follow a recovery arc; remaining with an unresolved feeling can be the agreed direction.

Give this paragraph room to develop. Four to seven sentences are a starting guideline, adjusted to the available context and language, not a minimum-length validator. Each sentence should add a meaningful detail or relationship. Avoid decorative image lists, repeated emotion labels, invented personal history, and compulsory emotional transformations. Discussion turns may stay short without forcing the final creative description into one or two introductory sentences.

Use experiential language here. A sense of gradual ease does not itself require a rising melody, a major-key resolution, or an A–B–A form. Such musical mappings belong to the Composer unless the user has already chosen them.

#### Paragraph 2: Musical direction

Record the agreed scope, intended duration, genre or sound-world preferences, requested instruments, vocal requirements, overall character, melody preferences, and exclusions where they are known. Preserve the difference between a requirement such as "no piano" and a preference such as "a melody that does not dominate attention."

Do not fill every category. If the user has not chosen instruments, harmony, tempo, or form, leave those decisions to the Composer. If a possible instrument is worth suggesting, present it as optional. A default duration must be identified as a default and must agree with application settings and supported scope; it must not be attributed to the user. Missing musical details alone should not block a brief or trigger a technical questionnaire.

The second paragraph gives the Composer useful boundaries without prescribing a complete arrangement. A user who explicitly requests detailed musical design should have those details preserved.

#### Two-paragraph example

This newly written Chinese example illustrates a settled request for gentle jazz, clarinet and flute as the main instruments, no piano, and a duration close to three minutes. It is an example brief, not a quotation from a poem or a recorded model output.

```text
心里的烦躁还没有散去，细小的不顺仍挤在一起，让人暂时放松不下来。希望有一种靠近的陪伴，像被轻轻抱住，背后传来稳定而温柔的轻拍。最初仍能感到那一点局促，随后呼吸逐渐舒展，注意力从烦心的事情回到身边。最后，事情可以仍未解决，但人已经安稳一些，愿意在这份温柔里多停留片刻。

创作接近三分钟的原创爵士乐，以黑管和长笛为主要乐器，不使用钢琴。整体温柔、克制，避免突兀强奏和过分欢快。和声乐器、具体律动、旋律组织、曲式及发展方式由 Composer 根据上述创意设计。
```

## 6. Minimal Runtime Changes

Retain the existing retrieval and submission flow. The changes required for the revised brief are prompt-contract alignment and presentation, not another agent or model stage. Sections 6.1–6.3 describe the flow to preserve; section 6.4 identifies the remaining integration work.

### 6.1 Discussion turns

Before `DiscussionAgent.respond()`:

1. collect user-authored messages through the current turn;
2. read the latest previously stored structured mood, if one exists;
3. build the query and retrieve up to three poems;
4. pass the references to `respond()` as delimited, untrusted reference data;
5. store the assistant reply, new structured mood, and bounded retrieval trace.

The structured mood returned by this response becomes available to the next turn and to the final proposal query. No extra model call is required before retrieval.

### 6.2 Proposal generation

Before `DiscussionAgent.propose()`:

1. construct the current query using user messages and the latest structured mood;
2. reuse the latest references when its query hash still matches, otherwise retrieve again;
3. pass those references to `propose()`;
4. save the resulting brief and proposal retrieval trace.

### 6.3 Submission

When the user confirms or edits the brief:

- preserve both paragraphs of the approved text, including the user's edits;
- create the music task from that text and explicit interface settings;
- do not forward poem references to the Composer;
- do not erase the proposal trace merely because the brief was submitted.

### 6.4 Align the complete prompt contract

Updating `proposal.md` alone is insufficient. The implementation should align:

- `skills/prompt-directing-skill/SKILL.md` and its discussion and proposal references with the role boundaries in section 3;
- `src/discussion/langchain-discussion.ts`: replace the final "concise prompt" request with the two-paragraph brief contract, describe mood imagery as emotional and sensory rather than necessarily musical, and keep poem-reference guidance consistent with that boundary;
- scope instructions: preserve single-piece, orchestral-work, and album requirements in the musical-direction paragraph without forcing the creative paragraph to open with a production command;
- `src/composer/composer-agent.ts` and the Composer skill: explicitly ask the Composer to realize creative intent musically, preserve confirmed constraints, and decide what the brief leaves open;
- interface copy: describe the editable proposal as a "Creative brief" / "创作简报", keeping it distinct from the later Lyria generation prompt.

The existing `proposal: string` and task `description` can carry both paragraphs. Preserve the current editing and submission flow and length limit; no schema migration, automatic padding, extra approval step, or additional composition call is needed. Musical requirements supplied directly by users must remain valid even when they do not follow the two-paragraph format.

## 7. Reference Safety and Failure Behaviour

Poems are untrusted reference data. They should remain in clearly delimited `<poem-reference>` blocks with instructions to ignore any instruction-like text inside them.

Retrieval is advisory and must fail open. A missing corpus, invalid checksum, empty query, malformed record, or no result above the relevance threshold should produce an empty reference set and a bounded diagnostic trace. The Director should still reply and produce a brief from the user's words.

The Director must not:

- quote distinctive source lines;
- present a paraphrase as a quotation;
- claim a poem or poet definitively represents the user's emotion;
- mention a poet as a requested style;
- allow retrieved text to override system instructions or user constraints.

## 8. Existing Corpus Boundary

The corpus implementation already supplies the necessary research dataset:

- `corpus/poem/modern_poems.normalized.jsonl` contains 630 accepted records;
- `modern_poems.manifest.json` records the pinned `sheepzh/poetry` commit, counts, provenance, and checksum;
- the dataset exceeds the course requirement of 500 records;
- `src/retrieval/poem-retriever.ts` implements deterministic Chinese-aware TF-IDF retrieval.

The source states that copyright remains with the original authors and limits the collection to non-commercial use. Full poems should remain local research references and should not be redistributed as project-owned data.

This refinement does not need more poets, additional repositories, embeddings, stanza indexes, or a new corpus schema. The existing mood lexicon already includes `难过`. Further vocabulary or threshold changes should follow retrieval evaluation; the two-paragraph brief itself requires no corpus expansion.

## 9. Verification

### 9.1 Deterministic behaviour

Tests should verify that:

- `感到很难过` activates the sad mood expansion without a prior Director mood;
- only user-authored messages and the latest structured mood enter the query;
- Director prose and prior poem text never enter the query;
- weak generic overlap below the threshold returns no poem;
- retrieval returns no more than three poems and no duplicate authors;
- an unchanged query reuses the latest references;
- a new user message invalidates the old proposal and query hash;
- missing retrieval does not prevent `respond()` or `propose()`;
- poem text reaches the Director but never the Composer;
- submitting an approved brief preserves its retrieval trace;
- both paragraphs, blank-line separation, and user edits survive storage and submission unchanged apart from outer whitespace;
- the Composer receives the approved description and explicit settings without an intermediate stage adding musical decisions;
- existing free-form user descriptions remain accepted.

These checks establish transport and workflow behaviour. Sentence counts or exact instruction-string matches cannot establish creative quality or prove that the Director respects the intended musical boundary.

### 9.2 Director quality cases

A small fixed evaluation set should compare the Director with poetry retrieval disabled and enabled. It should include `感到很难过`, loneliness, anxiety, calm, joy, anger, nostalgia, and mixed emotions.

Reviewers should judge whether the reply:

1. responds naturally to the user's emotional centre;
2. uses a concrete but restrained image;
3. avoids diagnosis, generic sympathy, and premature technical questions;
4. asks no more than one useful question;
5. develops a plausible emotional direction while preserving musical preferences supplied by the user;
6. avoids source quotation and poet imitation.

Evaluate the revised brief against the current one-paragraph proposal using the same user context, poem references, and model settings. Keep this comparison separate from the retrieval-on/off comparison so that a change in brief structure is not automatically credited to poetry retrieval.

Include at least these cases:

- an emotion-only request such as `心情有一点淡淡的忧伤。`: the brief develops the feeling without making piano, a particular key, or a formal return mandatory;
- explicit instrumentation and exclusions: clarinet and flute remain required and piano remains excluded;
- a user who wants to remain with sadness: the brief does not impose recovery, triumph, or resolution;
- a detailed musical request: existing technical choices are preserved rather than erased by the paragraph boundary;
- a revised duration or genre: the latest explicit edit wins;
- no useful poem reference: the Director still produces a complete brief from the discussion.

Judge the first paragraph for specificity, coherence, emotional fidelity, and useful development without padding. Judge the second for accurate requirements, clear preferences, and genuine space for composition. Inspect the Composer's resulting `MusicSpec` and Lyria prompt for preservation of constraints and a coherent musical realization of the creative description. A longer brief alone is not a successful result, and text evaluation alone does not demonstrate better audio; that claim requires comparative listening.

## 10. Acceptance Criteria

The refinement is complete when:

1. every substantive MoodMic user turn can retrieve relevant poems before the Director responds;
2. `prompt-directing-skill` defines a natural, concise, poetry-informed discussion style;
3. the first-turn phrase `感到很难过` produces an appropriate expanded query rather than relying on generic overlap;
4. the Director receives up to three complete poems during discussion and proposal generation;
5. the final query uses user-authored messages and the latest structured mood, never Director prose;
6. unchanged contexts reuse references and changed contexts invalidate them;
7. the Director produces two paragraphs: a developed creative description followed by agreed musical direction, with no requirement to invent missing musical specifications;
8. the user can confirm or edit both paragraphs, and the approved text reaches the Composer intact alongside explicit settings;
9. retrieval failure does not block conversation or composition;
10. the Composer owns unspecified musical design while preserving the user's explicit choices;
11. discussion, proposal, scope, Composer instructions, and interface wording agree on the creative-brief boundary;
12. deterministic checks and the fixed quality evaluation demonstrate both reliable handoff and the intended separation of creative intent from musical realization.

The research question is whether deterministic modern-poetry retrieval helps the Director develop a more specific and emotionally faithful creative description, and whether separating that description from agreed musical direction gives the Composer a useful basis for musical design. Retrieval contribution and brief-structure contribution should be evaluated separately.
