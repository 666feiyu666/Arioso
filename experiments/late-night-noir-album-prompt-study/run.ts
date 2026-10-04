import { Agent } from "@openai/agents";
import { z } from "zod";
import { config as dotenv } from "dotenv";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runComposerAgent } from "../../src/composer/agent-runner.js";
import { loadComposerSkill } from "../../src/composer/composer-skill.js";
import { composeMusic } from "../../src/composer/composer-agent.js";
import { MusicSpecSchema, type MusicSpec } from "../../src/schema/music-spec.js";
import { loadConfig } from "../../src/config/env.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "results");
const REQUEST = { theme: "late night noir jazz for relaxation", candidateCount: 14, vocalMode: "instrumental", corpusMode: "none", lyriaModel: "lyria-3.5", durationRangeSeconds: [60, 180], batchTargetMinutes: [30, 40], admission: "Every generated piece remains a candidate; the human decides admission later." };
const TrackSchema = z.object({ number: z.number().int().min(1).max(14), title: z.string(), musicalRole: z.string(), instruments: z.array(z.string()), groove: z.string(), harmony: z.string(), development: z.string(), targetSeconds: z.number().int().min(60).max(180) });
const PlanSchema = z.object({ albumTitle: z.string(), albumMind: z.string(), cohesionStrategy: z.string(), sharedSoundContract: z.string(), tracks: z.array(TrackSchema).length(14) });
const ReviewSchema = z.object({ verdict: z.enum(["ready", "needs-work"]), albumFindings: z.array(z.string()), similarities: z.array(z.object({ first: z.number().int().min(1).max(14), second: z.number().int().min(1).max(14), evidence: z.string(), judgment: z.string() })), candidates: z.array(z.object({ number: z.number().int().min(1).max(14), verdict: z.enum(["ready", "needs-work"]), evidence: z.array(z.string()).min(1), revisionBrief: z.string().nullable() })).length(14) });
type Plan = z.infer<typeof PlanSchema>;
type Track = z.infer<typeof TrackSchema>;
type Review = z.infer<typeof ReviewSchema>;
type Candidate = { track: Track; spec: MusicSpec; prompt: string };
const PLANNER = `You are Arioso's album planning author. Produce exactly 14 independent instrumental candidates for late night noir jazz for relaxation. Duration targets vary from 60 to 180 seconds and total 1800 to 2400 seconds; choose at least three different target lengths, not a fixed duration per track. Number candidates 1 through 14.
First develop albumMind: the author's substantive creative idea for this album, expressed as a musical listening experience serving its theme and purpose. Then develop cohesionStrategy: decide which musical and production features stay consistent, which change or form groups, and why that distribution serves late night noir and relaxation. Do not assume unified instrumentation, recording space or dynamics in advance; these are creative decisions for the album author. Connect the albumMind and strategy to audible arrangements rather than relying on generic scene adjectives.
Write a concise sharedSoundContract, preferably under 100 words, capturing the author's chosen principles and variation rules. This identical text will accompany every prompt, so express album-level rules compatible with all proposed candidates; specific track choices belong in their outlines. Instrumentation, room, texture and dynamics may differ when the plan explains their relationship to the albumMind.
Give each candidate a distinct musical role, groove, harmonic behavior and development implementing the albumMind and cohesionStrategy. Roles describe what musicians do, not only scenes or titles. Vary interaction, motivic behavior, harmonic rhythm, phrase density and texture trajectories where appropriate. Merely changing titles, keys or numerical BPM is insufficient variation. Similarity may be intentional; make its purpose and distribution clear. Differences are not automatically better. Each track must serve the relaxation purpose while retaining noir character, with its own beginning, development and ending and no dependency on another track. Avoid invented exact BPM or keys when unnecessary. Do not add instruments merely to manufacture superficial variety. Every output remains a candidate.`;
const REVIEWER = `You are Arioso's album prompt editor. Inspect ALL 14 actual rendered Lyria prompts and their MusicSpecs together, not just outlines. Evaluate them against the author's albumMind, cohesionStrategy and chosen sharedSoundContract. Judge realization of that musical idea, theme fit, instrumental consistency, variation distribution, substantive duplication, deviations from the author's rules, development proportional to duration, and concise priority of instructions.
Do not impose unified instrumentation, recording space or dynamics: the author chooses whether these stay consistent, vary or form groups. Difference itself is not an error and consistency is not automatic success. Determine whether similarities and differences serve the author's plan and the requested listening purpose. Changing titles, keys or numerical BPM alone does not resolve duplication. Compare musical roles, subdivision, harmony, melodic interaction, phrase density and development.
Quote short concrete phrases or identify specific arrangements from the inspected prompts in every candidate's evidence. Do not invent problems to justify editing. Keep good candidates with verdict ready and revisionBrief null. Substantive issues warrant needs-work with a short actionable brief changing a few specific musical elements. Preserve the albumMind, chosen variation rules, duration and instrumental intent. Do not demand extra instruments merely to manufacture diversity. Do not require audio evaluation, add listening warnings or assume admission.
Return exactly one judgment for each number 1 through 14. List useful pairwise similarities with concrete evidence and explain whether they serve the author's cohesion strategy or require an edit. After one repair pass, preserve ready/needs-work honestly and leave unresolved issues visible; do not request another automatic repair round. Album verdict is needs-work if any candidate is needs-work; ready candidates have no revision brief.`;
let stage = "setup";
let activeNumbers: number[] = [];
const startedAt = new Date().toISOString();
const serial = (value: unknown) => JSON.stringify(value, null, 2);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = (number: number) => String(number).padStart(2, "0");
const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
async function save(relative: string, value: unknown): Promise<void> {
  const destination = path.join(OUT, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(`${destination}.tmp`, typeof value === "string" ? value : `${serial(value)}\n`, "utf8");
  await rename(`${destination}.tmp`, destination);
}
async function cached(relative: string): Promise<unknown | undefined> {
  try { return JSON.parse(await readFile(path.join(OUT, relative), "utf8")) as unknown; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}
function numbered(numbers: number[]): boolean { return numbers.length === 14 && [...numbers].sort((a, b) => a - b).every((number, index) => number === index + 1); }
function validatePlan(plan: Plan): void {
  const total = plan.tracks.reduce((sum, track) => sum + track.targetSeconds, 0);
  if (!numbered(plan.tracks.map((track) => track.number)) || total < 1800 || total > 2400 || new Set(plan.tracks.map((track) => track.targetSeconds)).size < 3 || !plan.sharedSoundContract.trim()) throw new Error("Invalid candidate numbering, duration distribution, batch duration or shared contract.");
}
function validateReview(review: Review): void {
  if (!numbered(review.candidates.map((candidate) => candidate.number))) throw new Error("Invalid review candidate numbering.");
  if (review.candidates.some((candidate) => candidate.verdict === "ready" ? candidate.revisionBrief !== null : !candidate.revisionBrief?.trim())) throw new Error("Review revision briefs disagree with verdicts.");
  if (review.verdict === "ready" && review.candidates.some((candidate) => candidate.verdict === "needs-work")) throw new Error("Review album verdict disagrees with candidate verdicts.");
}
function header(plan: Plan): string { return `Late-night noir jazz for relaxation. Instrumental only, no vocals.\n\n${plan.sharedSoundContract.trim()}\n\n`; }
function render(plan: Plan, track: Track, spec: MusicSpec): string { return `${header(plan)}Aim for approximately ${track.targetSeconds} seconds, with a self-contained beginning, development and ending.\n\n${spec.lyriaPrompt.trim()}\n`; }
function validateCandidate(plan: Plan, candidate: Candidate): string[] {
  const { spec, prompt, track } = candidate;
  MusicSpecSchema.parse(spec);
  if (spec.vocals.enabled || [spec.vocals.language, spec.vocals.style, spec.vocals.lyricalTheme].some((value) => value !== null) || !/instrumental only, no vocals/i.test(spec.lyriaPrompt) || !prompt.startsWith(header(plan))) throw new Error("Candidate failed instrumental or fixed-contract validation.");
  if (/\b(previous|preceding|next|last|earlier)\s+(track|movement|candidate)\b|\bas (above|before)\b|\b(shared contract|album outline|candidate\s*#?\s*\d+)\b/i.test(spec.lyriaPrompt)) throw new Error("Candidate prompt contains a cross-track or planning dependency.");
  const timed = spec.structure.filter((section) => section.durationSeconds !== null);
  const sum = timed.reduce((total, section) => total + (section.durationSeconds ?? 0), 0);
  const tolerance = Math.max(15, track.targetSeconds * .1);
  if (timed.length === spec.structure.length && timed.length > 0 && Math.abs(sum - track.targetSeconds) > tolerance) return [`Candidate ${track.number}: sections total ${sum}s versus target ${track.targetSeconds}s.`];
  if (sum > track.targetSeconds + tolerance) return [`Candidate ${track.number}: partial section durations already total ${sum}s versus target ${track.targetSeconds}s.`];
  return [];
}
async function pool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const results = await Promise.allSettled(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; if (item !== undefined) await worker(item); }
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}
function composeBrief(plan: Plan, track: Track, repair?: { spec: MusicSpec; prompt: string; feedback: string; batch: Candidate[] }): string {
  return `These explicit constraints are authoritative: ${serial(REQUEST)}\n\nComplete batch context:\n${serial(plan)}\n\nCurrent candidate to compose:\n${serial(track)}\nPreserve its duration and shared sound contract. Prioritize its actual musical role and development. Keep lyriaPrompt concise and standalone, including the core shared sound. Do not insert track numbers, album-planning instructions or references to other candidates into lyriaPrompt. Approximate section durations, if supplied, should total the current target. Every candidate is instrumental only.\n${repair ? `\nOne permitted repair pass. Preserve good material. Editor feedback overrides the outline only for specified musical changes, never the shared contract, duration or instrumental setting.\nFeedback: ${repair.feedback}\nOriginal MusicSpec:\n${serial(repair.spec)}\nOriginal rendered prompt:\n${repair.prompt}\nCurrent batch prompts for comparison:\n${serial(repair.batch.map((candidate) => ({ number: candidate.track.number, prompt: candidate.prompt })))}` : ""}`;
}
async function check(): Promise<void> {
  const plan = PlanSchema.parse({ albumTitle: "Local validation fixture", albumMind: "A quiet nocturnal listening arc", cohesionStrategy: "Related sparse gestures with varied interaction", sharedSoundContract: "Quiet intimate piano, upright bass and brushed drums; restrained dynamics and warm room sound.", tracks: Array.from({ length: 14 }, (_, index) => ({ number: index + 1, title: `Fixture ${index + 1}`, musicalRole: "Sparse piano motif", instruments: ["piano", "upright bass", "brushes"], groove: "Unhurried swing", harmony: "Slow minor harmony", development: "Motif, thinning texture, resolved close", targetSeconds: [120, 150, 180][index % 3] })) });
  validatePlan(plan);
  const spec = MusicSpecSchema.parse({ schemaVersion: "1.0", title: "Fixture", intent: REQUEST.theme, genres: ["jazz"], moods: ["relaxed"], tempo: { bpm: null, feel: "Unhurried swing" }, tonality: { tonic: null, mode: "minor" }, meter: "4/4", instrumentation: [{ name: "piano", role: "motif", timbre: "soft" }], structure: [{ section: "Development", durationSeconds: 120, direction: "Sparse motif then resolved ending" }], vocals: { enabled: false, language: null, style: null, lyricalTheme: null }, production: "Intimate", avoid: ["vocals"], assumptions: [], lyriaPrompt: "Instrumental only, no vocals. Soft jazz piano plays a sparse motif over slow minor harmony, develops through small voicing changes and closes quietly." });
  const track = plan.tracks[0]!;
  if (validateCandidate(plan, { track, spec, prompt: render(plan, track, spec) }).length) throw new Error("Fixture unexpectedly failed section timing.");
  const bad = { ...spec, vocals: { ...spec.vocals, enabled: true } };
  let rejected = false;
  try { validateCandidate(plan, { track, spec: bad, prompt: render(plan, track, bad) }); } catch { rejected = true; }
  if (!rejected) throw new Error("Vocal validation did not reject an invalid fixture.");
  validateReview(ReviewSchema.parse({ verdict: "ready", albumFindings: [], similarities: [], candidates: plan.tracks.map((item) => ({ number: item.number, verdict: "ready", evidence: ["Local schema fixture only"], revisionBrief: null })) }));
  console.log("Local schema, numbering, duration, renderer, instrumental rejection and review checks passed; no API calls.");
}
async function main(): Promise<void> {
  if (process.argv.includes("--check")) { await check(); return; }
  dotenv({ path: path.join(ROOT, ".env"), override: false, quiet: true });
  const config = loadConfig(false);
  const skill = await loadComposerSkill();
  const options = { apiKey: config.openAiApiKey, model: config.openAiModel, lyriaModel: "lyria-3.5", vocalMode: "instrumental" as const, corpusMode: "none" as const, genre: "jazz" as const };
  await save("input.json", REQUEST);
  await save("TASK.md", `# Album prompt experiment task\n\n## Request\n\n${serial(REQUEST)}\n\n## Planner instructions\n\n${PLANNER}\n\n## Reviewer instructions\n\n${REVIEWER}\n\n## Composer task\n\nEach call receives the entire plan and the authoritative current outline through existing composeMusic(), with instrumental/no-corpus/jazz/Lyria 3.5 options. Exact per-candidate input is saved beside its spec. Repairs receive the original spec and prompt, reviewer brief and entire original prompt batch.\n\n## Existing composer skill used\n\n${skill}\n`);
  await save("metadata.json", { startedAt, composerModel: config.openAiModel, promptTargetModel: "lyria-3.5", status: "candidate", maxConcurrency: 3, maxRepairPasses: 1, apiWorkflow: "Existing Arioso runComposerAgent and composeMusic; no audio generation calls" });
  stage = "plan";
  const savedPlan = await cached("initial-plan.json");
  const planner = new Agent({ name: "Arioso Album Prompt Planner", instructions: `${PLANNER}\n\nExisting composer skill:\n${skill}`, model: config.openAiModel, outputType: PlanSchema });
  const plan = PlanSchema.parse(savedPlan ?? await runComposerAgent(planner, serial(REQUEST), "Album planner returned no plan.", config.openAiApiKey));
  validatePlan(plan);
  plan.tracks.sort((a, b) => a.number - b.number);
  await save("initial-plan.json", plan);
  console.log("Album plan ready: 14 candidates; composing with concurrency 3.");
  stage = "initial-composition";
  const initial: Candidate[] = [];
  async function candidate(track: Track, phase: "initial" | "final", brief: string): Promise<Candidate> {
    const stem = `${phase}/${id(track.number)}`;
    const fingerprint = hash({ plan, track, brief, model: config.openAiModel });
    const checkpoint = z.object({ inputSha256: z.string(), spec: MusicSpecSchema }).safeParse(await cached(`${stem}.checkpoint.json`));
    activeNumbers.push(track.number);
    try {
      await save(`${stem}.input.md`, brief);
      const spec = checkpoint.success && checkpoint.data.inputSha256 === fingerprint ? checkpoint.data.spec : await composeMusic(brief, options);
      const result = { track, spec, prompt: render(plan, track, spec) };
      validateCandidate(plan, result);
      await save(`${stem}.spec.json`, spec);
      await save(`${stem}.prompt.md`, result.prompt);
      await save(`${stem}.checkpoint.json`, { inputSha256: fingerprint, spec });
      console.log(`${phase} candidate ${id(track.number)} saved.`);
      return result;
    } finally { activeNumbers = activeNumbers.filter((number) => number !== track.number); }
  }
  await pool(plan.tracks, async (track) => { initial.push(await candidate(track, "initial", composeBrief(plan, track))); });
  initial.sort((a, b) => a.track.number - b.track.number);
  async function reviewBatch(batch: Candidate[], phase: "initial" | "final"): Promise<Review> {
    const input = serial({ request: REQUEST, plan, phase, validationWarnings: batch.flatMap((item) => validateCandidate(plan, item)), candidates: batch.map((item) => ({ number: item.track.number, targetSeconds: item.track.targetSeconds, spec: item.spec, renderedLyriaPrompt: item.prompt })) });
    const fingerprint = hash({ input, instructions: REVIEWER, model: config.openAiModel });
    const prior = z.object({ inputSha256: z.string(), review: ReviewSchema }).safeParse(await cached(`${phase}-review.checkpoint.json`));
    await save(`${phase}-review.input.json`, JSON.parse(input));
    const editor = new Agent({ name: "Arioso Album Prompt Reviewer", instructions: `${REVIEWER}\n\nExisting composer skill:\n${skill}`, model: config.openAiModel, outputType: ReviewSchema });
    const review = prior.success && prior.data.inputSha256 === fingerprint ? prior.data.review : ReviewSchema.parse(await runComposerAgent(editor, input, "Album reviewer returned no review.", config.openAiApiKey));
    validateReview(review);
    await save(`${phase}-review.json`, review);
    await save(`${phase}-review.checkpoint.json`, { inputSha256: fingerprint, review });
    return review;
  }
  stage = "initial-review";
  const firstReview = await reviewBatch(initial, "initial");
  const flagged = firstReview.candidates.filter((item) => item.verdict === "needs-work");
  console.log(`Initial review: ${flagged.length} candidates need the single repair pass.`);
  stage = "single-repair-pass";
  const final = [...initial];
  await pool(flagged, async (feedback) => {
    const original = initial.find((item) => item.track.number === feedback.number)!;
    const revised = await candidate(original.track, "final", composeBrief(plan, original.track, { spec: original.spec, prompt: original.prompt, feedback: feedback.revisionBrief!, batch: initial }));
    final[final.findIndex((item) => item.track.number === feedback.number)] = revised;
  });
  for (const item of final.filter((item) => !flagged.some((feedback) => feedback.number === item.track.number))) {
    await save(`final/${id(item.track.number)}.spec.json`, item.spec);
    await save(`final/${id(item.track.number)}.prompt.md`, item.prompt);
  }
  stage = "final-review";
  const finalReview = await reviewBatch(final, "final");
  const warnings = final.flatMap((item) => validateCandidate(plan, item));
  await save("final-plan.json", { ...plan, tracks: final.map(({ track, spec }) => ({ ...track, title: spec.title, instruments: spec.instrumentation.map((instrument) => `${instrument.name}: ${instrument.role}`), groove: spec.tempo.feel, harmony: [spec.tonality.tonic, spec.tonality.mode].filter(Boolean).join(" ") || track.harmony, development: spec.structure.map((section) => `${section.section}: ${section.direction}`).join("; "), status: "candidate" })) });
  const duration = final.reduce((sum, item) => sum + item.track.targetSeconds, 0);
  await save("validation.json", { count: final.length, numbering: numbered(final.map((item) => item.track.number)), durationRangeSeconds: [60, 180], durationTargets: final.map((item) => item.track.targetSeconds), plannedBatchSeconds: duration, instrumental: true, sharedContractIdentical: true, standaloneDependencyCheck: true, sectionTimingWarnings: warnings, finalReview: finalReview.verdict, status: "candidate" });
  const table = final.map((item) => {
    const decision = finalReview.candidates.find((entry) => entry.number === item.track.number)!;
    return `| ${id(item.track.number)} | ${cell(item.spec.title)} | ${item.track.targetSeconds}s | ${cell(item.track.musicalRole)} | ${decision.verdict} | [Prompt](final/${id(item.track.number)}.prompt.md) · [Spec](final/${id(item.track.number)}.spec.json) |`;
  }).join("\n");
  const corrections = flagged.length ? flagged.map((feedback) => {
    const before = initial.find((item) => item.track.number === feedback.number)!;
    const after = final.find((item) => item.track.number === feedback.number)!;
    const judgment = finalReview.candidates.find((item) => item.number === feedback.number)!;
    return `### Candidate ${id(feedback.number)}\n\nInitial evidence: ${feedback.evidence.join(" ")}\n\nRequested correction: ${feedback.revisionBrief}\n\n[Original](initial/${id(feedback.number)}.prompt.md) → [Revised](final/${id(feedback.number)}.prompt.md). Prompt changed: ${before.prompt !== after.prompt}.\n\nFinal judgment: **${judgment.verdict}**. ${judgment.evidence.join(" ")}\n`;
  }).join("\n") : "The reviewer requested no repairs. Initial prompts are retained; no problems were manufactured to force a revision.\n";
  const unresolved = finalReview.candidates.filter((item) => item.verdict === "needs-work").map((item) => `- Candidate ${item.number}: ${item.evidence.join(" ")} Remaining brief: ${item.revisionBrief}`).join("\n") || "No unresolved prompt issues were reported by the final reviewer.";
  await save("REPORT.md", `# Late Night Noir: one-batch album prompt experiment\n\n**14 candidates**, one batch review and at most one targeted repair pass. Status: **candidate**. Prompt verdict: **${finalReview.verdict}**. Human admission has not occurred.\n\nStarted: ${startedAt}. Finished: ${new Date().toISOString()}. Existing composer model: **${config.openAiModel}**. Prompt target: **Lyria 3.5**. Audio generation calls: **0**. Concurrency: **3**.\n\n## Task and existing architecture\n\n[Request](input.json), [planner/reviewer instructions and composer skill](TASK.md). Uses existing Arioso loadComposerSkill(), runComposerAgent() and composeMusic(). Jazz/no-corpus and explicit instrumental settings are passed to the composer. Every exact per-track composer input is saved alongside its initial or repaired spec.\n\n## Author-selected album idea and cohesion strategy\n\n${plan.albumMind}\n\n${plan.cohesionStrategy}\n\n## Shared album-level principles and variation rules\n\n${plan.sharedSoundContract}\n\n## Final candidates\n\nTargets vary within 1–3 minutes; planned batch total ${(duration / 60).toFixed(1)} minutes. These are compositional targets, not measured audio durations.\n\n| No. | Title | Target | Musical role | Review | Files |\n| --- | --- | --- | --- | --- | --- |\n${table}\n\n[Initial plan](initial-plan.json) · [Final plan](final-plan.json) · [Initial review](initial-review.json) · [Final review](final-review.json). Final-plan summaries reflect the generated specs while preserving planned musical roles and durations.\n\n## Concrete corrections\n\n${corrections}\n## Remaining decisions\n\n${unresolved}\n\n${finalReview.albumFindings.map((finding) => `- ${finding}`).join("\n")}\n\n## Validation\n\n[Machine validation](validation.json): 14 numbered candidates; 60–180s individual targets and 30–40-minute batch target; varied durations; instrumental specs; identical renderer-inserted shared contract; no detected explicit cross-track dependency in prompts. Supplied section timings are checked against the target.\n\n${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "No section-timing discrepancy exceeded the tolerance (15 seconds or 10%). Untimed sections remain flexible."}\n\nQualitative review examines the actual final prompts for theme, consistency and substantive duplication with concrete evidence. Similarities and differences are judged against the author-chosen albumMind and cohesionStrategy, without pre-imposing identical instrumentation, space or dynamics. No audio evaluation or automatic admission is part of this experiment.\n`);
  await save("state.json", { status: "completed", phase: "complete", finishedAt: new Date().toISOString(), candidateStatus: "candidate", finalReview: finalReview.verdict });
  console.log(`Completed: ${finalReview.verdict}. Report: ${path.join(OUT, "REPORT.md")}`);
}
try { await main(); }
catch (error) {
  const item = error as { name?: unknown; status?: unknown; code?: unknown };
  const safe = { name: typeof item.name === "string" && /^[A-Za-z]+Error$/.test(item.name) ? item.name : "Error", status: typeof item.status === "number" ? item.status : null, code: typeof item.code === "string" && /^[A-Z_0-9]{1,40}$/.test(item.code) ? item.code : null };
  try { if (!process.argv.includes("--check")) await save("state.json", { status: "failed", phase: stage, activeCandidateNumbers: activeNumbers, failedAt: new Date().toISOString(), error: safe, message: "Execution stopped; valid checkpoints are preserved. Raw error bodies and request/configuration details are omitted." }); } catch { /* Never print secondary error bodies. */ }
  console.error(`Stopped during ${stage}: ${safe.name}${safe.status === null ? "" : ` (status ${safe.status})`}. No credentials or raw error body logged.`);
  process.exitCode = 1;
}

