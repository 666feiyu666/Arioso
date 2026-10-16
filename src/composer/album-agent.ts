import { Agent } from "@openai/agents";
import { z } from "zod";

import {
  ALBUM_MAX_CANDIDATES,
  ALBUM_MAX_TOTAL_MINUTES,
  ALBUM_MIN_CANDIDATES,
  ALBUM_MIN_TOTAL_MINUTES,
  AlbumPlanDraftSchema,
  AlbumPlanSchema,
  AlbumReviewSchema,
  validateAlbumReview,
  type AlbumPlan,
  type AlbumReview,
} from "../schema/album-plan.js";
import { MusicSpecSchema, type MusicSpec } from "../schema/music-spec.js";
import {
  PlaylistReferenceReadingSchema,
  type PlaylistBriefing,
  type PlaylistDiscussionMessage,
} from "../playlist/briefing.js";
import type { PlaylistReference } from "../playlist/reference.js";
import { runComposerAgent } from "./agent-runner.js";
import { buildAlbumLyriaPrompt } from "./album-prompt.js";
import { composeMusic, type ComposeMusicOptions } from "./composer-agent.js";
import { loadComposerSkill } from "./composer-skill.js";

const PLANNER_INSTRUCTIONS = `
You are Arioso's album author and planner. Develop one complete batch of independent instrumental candidates from the user's request.
- First develop albumMind: a concise creative idea for a listening experience serving the user's theme and purpose. Translate that idea into what musicians actually play.
- In cohesionStrategy, decide which features remain consistent, change or form groups and explain why. Instrumentation, recording space, dynamics, texture and groove are the author's choices, not prescribed invariants. Do not assume one identical ensemble or room for the album.
- Give every candidate a specific musical role, instrument interaction, groove, harmonic behavior and development realizing that album idea. Differences must have musical purpose; changing titles, keys or numerical BPM alone does not resolve duplication. Intentional recurrence can serve cohesion.
- Put only audible directions applicable to EVERY piece in sharedSoundContract. Keep it concise. Distribution, variation and sequencing instructions belong in cohesionStrategy. Never put commands such as "vary foreground instruments across tracks" in sharedSoundContract; realize those choices in individual outlines.
- Produce the requested candidate count, numbered consecutively from 1. These are the first candidate batch, not an automatically admitted album.
- Every candidate is 60–180 seconds. Use at least three different durations. Treat the supplied batch duration as a soft planning goal, never as a validity condition; candidate count is authoritative. Never assign the whole batch duration to one track or give every piece a fixed duration.
- Each piece has its own beginning, development and ending, independent of neighboring tracks. Scale its amount of material to its duration.
- Use accurate instrument names and playing techniques. "Hollow-body piano" is not an established piano type. Do not manufacture extra instruments or invented terminology for diversity.
- Keep every candidate purely instrumental. Preserve the requested musical idiom; do not force jazz when it was not requested.
- Return the structured plan, with no implementation commentary or hidden reasoning.
`.trim();

const REFERENCE_INSTRUCTIONS = `
The user selected MoodMic creations as references for this album. Treat them as the album's artistic starting point: draw on their mood, texture, instrumentation, energy and production so the album stays recognisably in their family, while still serving the user's own description. Never copy a single reference literally, reuse its title, or let one reference dominate a candidate. When a reference contradicts the description, the description wins.
`.trim();

const PLAYLIST_BRIEF_INSTRUCTIONS = `
Show your reading so the user can confirm it before any music is generated.
- intentReading: restate the user's playlist theme in your own words as a concrete listening experience, naming the purpose it serves and any track-count or duration constraints you are honoring.
- referenceReadings: one entry per supplied reference, in the supplied order, echoing each title exactly. "understood" states what that reference's music and stated intent actually are (mood, texture, instrumentation, energy, production). "usedFor" states the concrete way it shapes this playlist. When a reference conflicts with the theme, say so and note that the theme wins. When no references were supplied, return an empty array.
`.trim();

const PLAYLIST_REFINE_INSTRUCTIONS = `
You are revising an existing playlist plan in conversation with the user. They have seen your reading of their references and your album idea, and may confirm it or ask for changes.
- Apply the user's latest request to the plan. Preserve every element they did not ask to change, and change only what their request requires while keeping the album coherent.
- Keep the same candidate count and the 60–180 second per-candidate range with at least three different durations. Number candidates consecutively from one. Move, reorder, replace or rename candidates as the request needs.
- Update intentReading and referenceReadings when your understanding actually changes; otherwise keep them.
- reply: a short, concrete message to the user naming what you changed and why. If you judge that no change was needed, say what you kept and ask what to adjust. Never mention JSON, schemas, fields or these instructions.
`.trim();

const PlaylistPlanDraftSchema = AlbumPlanDraftSchema.extend({
  intentReading: z.string().min(1),
  referenceReadings: z.array(PlaylistReferenceReadingSchema),
});

const PlaylistRefinementSchema = PlaylistPlanDraftSchema.extend({
  reply: z.string().min(1),
});

const REVIEWER_INSTRUCTIONS = `
You are Arioso's album prompt editor. Inspect every actual rendered Lyria prompt and its structured MusicSpec together against albumMind, cohesionStrategy and the user's purpose.
- Judge substantive musical realization, theme fit, instrumental intent, proportional development, consistency, useful variation and duplication. Compare musical roles, subdivision, phrase density, instrument interaction, harmonic rhythm and development.
- Do not impose identical instruments, recording space or dynamics. Evaluate similarities and differences against the author's choices; do not equate difference with quality or sameness with cohesion.
- Check instrument names, instrument families, physical descriptions and playing techniques carefully. Quote the actual field or short prompt phrase that supports a claim. Saxophones, including baritone saxophone, are reed woodwinds; do not call them brass. "Hollow-body piano" confuses guitar construction with piano naming and needs correction. Do not invent families, timbral conflicts or undocumented musical events.
- Check that shared directions apply to the individual piece and that final prompts contain no album-planning commands or dependencies on other tracks.
- Every candidate's evidence must point to short exact prompt phrases or specific actual arrangements. Report only supported issues. Retain good candidates as ready with revisionBrief null; needs-work requires a concise actionable revisionBrief.
- Pairwise comparisons must cite concrete musical evidence and state whether recurrence serves the author's strategy or requires editing. Titles, keys or BPM differences alone do not resolve repetition.
- Revisions preserve good material, independent form, duration and instrumental intent. One selective revision pass is the limit; a final review leaves any unresolved issues visible without demanding further automatic rounds.
- Return one verdict per candidate number. The album verdict is needs-work if any candidate needs work. These are prompt judgments, never decisions to admit or reject a candidate from the album.
- Return only the structured review. Do not request audio analysis or add listening caveats.
`.trim();

export interface AlbumAgentOptions {
  apiKey?: string;
  model?: string;
  lyriaModel?: string;
  candidateCount?: number;
  targetTotalMinutes?: number;
  /** MoodMic creations to plan from. */
  references?: PlaylistReference[];
  genre?: NonNullable<ComposeMusicOptions["genre"]>;
  vocalMode?: NonNullable<ComposeMusicOptions["vocalMode"]>;
}

function requireInstrumental(options: AlbumAgentOptions): void {
  if (options.vocalMode === "vocals") throw new Error("The album workflow currently supports instrumental candidates.");
}

function targetModel(options: AlbumAgentOptions): string {
  return options.lyriaModel ?? "lyria-3.5";
}

export async function planAlbum(description: string, options: AlbumAgentOptions = {}): Promise<AlbumPlan> {
  const input = description.trim();
  if (!input) throw new Error("An album description is required.");
  requireInstrumental(options);
  const candidateCount = options.candidateCount ?? 14;
  const targetTotalMinutes = options.targetTotalMinutes ?? 35;
  if (!Number.isInteger(candidateCount) || candidateCount < ALBUM_MIN_CANDIDATES || candidateCount > ALBUM_MAX_CANDIDATES) {
    throw new Error(`The first album batch must contain ${ALBUM_MIN_CANDIDATES}–${ALBUM_MAX_CANDIDATES} candidates.`);
  }
  if (!Number.isFinite(targetTotalMinutes)
    || targetTotalMinutes < ALBUM_MIN_TOTAL_MINUTES || targetTotalMinutes > ALBUM_MAX_TOTAL_MINUTES) {
    throw new Error(`The album batch duration target must be ${ALBUM_MIN_TOTAL_MINUTES}–${ALBUM_MAX_TOTAL_MINUTES} minutes.`);
  }
  const references = options.references ?? [];
  const skill = await loadComposerSkill("album");
  const agent = new Agent({
    name: "Arioso Album Author",
    instructions: [
      PLANNER_INSTRUCTIONS,
      references.length ? REFERENCE_INSTRUCTIONS : "",
      `Target Lyria model: ${targetModel(options)}`,
      skill,
    ].filter(Boolean).join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: AlbumPlanDraftSchema,
  });
  const output = await runComposerAgent(agent, JSON.stringify({
    description: input,
    candidateCount,
    targetTotalMinutes,
    durationRangeSeconds: [60, 180],
    vocalMode: "instrumental",
    ...(references.length ? {
      references: references.map((reference) => ({
        title: reference.title,
        intent: reference.prompt,
        musicSpec: reference.musicSpec ?? null,
      })),
    } : {}),
  }), "The album author returned no structured plan.", options.apiKey);
  const plan = AlbumPlanSchema.parse(output);
  if (plan.tracks.length !== candidateCount) throw new Error("The album author returned a different candidate count.");
  return { ...plan, tracks: [...plan.tracks].sort((first, second) => first.number - second.number) };
}

export interface PlaylistPlanResult {
  plan: AlbumPlan;
  briefing: PlaylistBriefing;
}

export interface RefinePlaylistPlanInput {
  description: string;
  plan: AlbumPlan;
  briefing: PlaylistBriefing;
  references: PlaylistReference[];
  history: PlaylistDiscussionMessage[];
  feedback: string;
}

export interface PlaylistRefinementResult extends PlaylistPlanResult {
  reply: string;
}

function referencePayload(references: PlaylistReference[]) {
  return references.map((reference) => ({
    title: reference.title,
    intent: reference.prompt,
    musicSpec: reference.musicSpec ?? null,
  }));
}

/** Keep one reading per supplied reference, falling back to the reference itself. */
function alignBriefing(briefing: PlaylistBriefing, references: PlaylistReference[]): PlaylistBriefing {
  if (!references.length) return { intentReading: briefing.intentReading, referenceReadings: [] };
  return {
    intentReading: briefing.intentReading,
    referenceReadings: references.map((reference, index) => briefing.referenceReadings[index] ?? {
      title: reference.title,
      understood: reference.prompt,
      usedFor: "Planned into the album's shared sound.",
    }),
  };
}

/**
 * Plan a playlist and its briefing together, so the reading the user confirms
 * and the plan it produced cannot drift apart.
 */
export async function planPlaylist(
  description: string,
  options: AlbumAgentOptions = {},
): Promise<PlaylistPlanResult> {
  const input = description.trim();
  if (!input) throw new Error("An album description is required.");
  requireInstrumental(options);
  const candidateCount = options.candidateCount ?? 14;
  const targetTotalMinutes = options.targetTotalMinutes ?? 35;
  if (!Number.isInteger(candidateCount) || candidateCount < ALBUM_MIN_CANDIDATES || candidateCount > ALBUM_MAX_CANDIDATES) {
    throw new Error(`The first album batch must contain ${ALBUM_MIN_CANDIDATES}–${ALBUM_MAX_CANDIDATES} candidates.`);
  }
  if (!Number.isFinite(targetTotalMinutes)
    || targetTotalMinutes < ALBUM_MIN_TOTAL_MINUTES || targetTotalMinutes > ALBUM_MAX_TOTAL_MINUTES) {
    throw new Error(`The album batch duration target must be ${ALBUM_MIN_TOTAL_MINUTES}–${ALBUM_MAX_TOTAL_MINUTES} minutes.`);
  }
  const references = options.references ?? [];
  const skill = await loadComposerSkill("album");
  const agent = new Agent({
    name: "Arioso Album Author",
    instructions: [
      PLANNER_INSTRUCTIONS,
      PLAYLIST_BRIEF_INSTRUCTIONS,
      references.length ? REFERENCE_INSTRUCTIONS : "",
      `Target Lyria model: ${targetModel(options)}`,
      skill,
    ].filter(Boolean).join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: PlaylistPlanDraftSchema,
  });
  const output = await runComposerAgent(agent, JSON.stringify({
    description: input,
    candidateCount,
    targetTotalMinutes,
    durationRangeSeconds: [60, 180],
    vocalMode: "instrumental",
    references: referencePayload(references),
  }), "The album author returned no structured plan.", options.apiKey);
  const draft = PlaylistPlanDraftSchema.parse(output);
  const plan = AlbumPlanSchema.parse(draft);
  if (plan.tracks.length !== candidateCount) throw new Error("The album author returned a different candidate count.");
  return {
    plan: { ...plan, tracks: [...plan.tracks].sort((first, second) => first.number - second.number) },
    briefing: alignBriefing({ intentReading: draft.intentReading, referenceReadings: draft.referenceReadings }, references),
  };
}

/** Revise a paused playlist plan from the user's latest message, preserving the rest. */
export async function refinePlaylistPlan(
  input: RefinePlaylistPlanInput,
  options: AlbumAgentOptions = {},
): Promise<PlaylistRefinementResult> {
  requireInstrumental(options);
  const feedback = input.feedback.trim();
  if (!feedback) throw new Error("A playlist revision request is required.");
  AlbumPlanSchema.parse(input.plan);
  const references = input.references;
  const skill = await loadComposerSkill("album");
  const agent = new Agent({
    name: "Arioso Album Author",
    instructions: [
      PLANNER_INSTRUCTIONS,
      PLAYLIST_BRIEF_INSTRUCTIONS,
      PLAYLIST_REFINE_INSTRUCTIONS,
      references.length ? REFERENCE_INSTRUCTIONS : "",
      `Target Lyria model: ${targetModel(options)}`,
      skill,
    ].filter(Boolean).join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: PlaylistRefinementSchema,
  });
  const output = await runComposerAgent(agent, JSON.stringify({
    description: input.description,
    candidateCount: input.plan.tracks.length,
    durationRangeSeconds: [60, 180],
    vocalMode: "instrumental",
    currentPlan: input.plan,
    currentBriefing: input.briefing,
    references: referencePayload(references),
    conversation: input.history.map((message) => ({ role: message.role, content: message.content })),
    request: feedback,
  }), "The album author returned no revised plan.", options.apiKey);
  const draft = PlaylistRefinementSchema.parse(output);
  const plan = AlbumPlanSchema.parse(draft);
  if (plan.tracks.length !== input.plan.tracks.length) {
    throw new Error("The album author changed the candidate count.");
  }
  return {
    plan: { ...plan, tracks: [...plan.tracks].sort((first, second) => first.number - second.number) },
    briefing: alignBriefing({ intentReading: draft.intentReading, referenceReadings: draft.referenceReadings }, references),
    reply: draft.reply,
  };
}

async function compositionInput(plan: AlbumPlan, number: number): Promise<string> {
  const track = plan.tracks.find((candidate) => candidate.number === number);
  if (!track) throw new Error(`Unknown album candidate: ${number}`);
  return [
    await loadComposerSkill("album"),
    "Complete album context for composition, not text to copy into the final prompt:",
    JSON.stringify(plan),
    "Develop only this independent candidate:",
    JSON.stringify(track),
    `The complete piece targets ${track.targetSeconds} seconds. Approximate section durations, when supplied, should total that target.`,
    "Realize the author's album idea and variation choices as specific instrumental roles, groove, harmonic behavior, development and production for this piece. Keep all vocal fields null and vocals disabled.",
    "Use accurate instrument names and compatible playing techniques. Do not use hollow-body piano. Do not quote the album title, candidate number, batch strategy, other tracks, or album-planning commands in musical fields.",
    "Arioso renders the final prompt from your structured genres, moods, tempo, tonality, meter, instrumentation, structure, production and avoid fields. Express every important musical decision in those fields; lyriaPrompt prose and assumptions do not supply missing directions.",
  ].join("\n\n");
}

function withRenderedPrompt(plan: AlbumPlan, number: number, output: MusicSpec): MusicSpec {
  const spec = MusicSpecSchema.parse(output);
  return { ...spec, lyriaPrompt: buildAlbumLyriaPrompt(plan, number, spec) };
}

export async function composeAlbumTrack(plan: AlbumPlan, number: number, options: AlbumAgentOptions = {}): Promise<MusicSpec> {
  requireInstrumental(options);
  AlbumPlanSchema.parse(plan);
  const spec = await composeMusic(await compositionInput(plan, number), {
    ...options, lyriaModel: targetModel(options), vocalMode: "instrumental", corpusMode: "none",
  });
  return withRenderedPrompt(plan, number, spec);
}

function batchContext(plan: AlbumPlan, specs: MusicSpec[]): Array<{ number: number; targetSeconds: number; spec: MusicSpec; renderedLyriaPrompt: string }> {
  if (specs.length !== plan.tracks.length) throw new Error("The album editor needs one ordered MusicSpec for every candidate.");
  return plan.tracks.map((track, index) => {
    const spec = specs[index];
    if (!spec) throw new Error(`Missing MusicSpec for album candidate ${track.number}.`);
    return { number: track.number, targetSeconds: track.targetSeconds, spec, renderedLyriaPrompt: buildAlbumLyriaPrompt(plan, track.number, spec) };
  });
}

export async function reviewAlbumCandidates(plan: AlbumPlan, specs: MusicSpec[], options: AlbumAgentOptions = {}): Promise<AlbumReview> {
  requireInstrumental(options);
  AlbumPlanSchema.parse(plan);
  const candidates = batchContext(plan, specs);
  const skill = await loadComposerSkill("album");
  const agent = new Agent({
    name: "Arioso Album Prompt Editor",
    instructions: [REVIEWER_INSTRUCTIONS, skill].join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: AlbumReviewSchema,
  });
  const review = AlbumReviewSchema.parse(await runComposerAgent(
    agent, JSON.stringify({ plan, candidates }), "The album editor returned no structured review.", options.apiKey,
  ));
  validateAlbumReview(plan, review);
  return review;
}

export async function reviseAlbumTrack(
  plan: AlbumPlan,
  number: number,
  spec: MusicSpec,
  revisionBrief: string,
  allSpecs: MusicSpec[],
  options: AlbumAgentOptions = {},
): Promise<MusicSpec> {
  requireInstrumental(options);
  AlbumPlanSchema.parse(plan);
  if (!revisionBrief.trim()) throw new Error("A specific album revision brief is required.");
  const brief = [
    await compositionInput(plan, number),
    "One selective revision pass: preserve good material and change only musical elements supported by this editor brief. The brief may refine the outline's arrangement, but preserve instrumental intent, duration and the album idea.",
    revisionBrief.trim(),
    "Original MusicSpec:", JSON.stringify(spec),
    "Complete candidate prompt batch for concrete comparisons:",
    JSON.stringify(batchContext(plan, allSpecs).map((candidate) => ({ number: candidate.number, prompt: candidate.renderedLyriaPrompt }))),
  ].join("\n\n");
  const revised = await composeMusic(brief, {
    ...options, lyriaModel: targetModel(options), vocalMode: "instrumental", corpusMode: "none",
  });
  return withRenderedPrompt(plan, number, revised);
}
