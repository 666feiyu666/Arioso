// DH6012 end-to-end evaluation harness.
//
// Runs one scenario from docs/DH6012-Documentation/DH6012_Eval.md:
//   Condition A  baseline           initial message -> Lyria
//   Condition B  arioso-workflow    initial message -> poetry -> Director -> brief
//                                   -> Composer + MusicSpec -> Lyria (+ review)
//
// Run from the repository root so the corpus paths resolve:
//   npx tsx eval/run-scenario.ts --scenario 01
//   npx tsx eval/run-scenario.ts --scenario 01 --resume   (reuse partial.json)
//
// Duration: the plan does not equalise duration, but this run fixes it at about
// three minutes for both conditions (an explicit instruction for this study),
// recorded in the run record as an override.

import "dotenv/config";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "../src/composer/composer-agent.js";
import { loadConfig } from "../src/config/env.js";
import { LangChainDiscussionAgent } from "../src/discussion/langchain-discussion.js";
import type {
  DiscussionAgentMessage,
  DiscussionMood,
  PoemReference,
} from "../src/discussion/types.js";
import { LyriaClient } from "../src/lyria/lyria-client.js";
import { GeminiMusicReviewer } from "../src/moodmic/music-review.js";
import {
  buildPoemQuery,
  detectPoemLanguage,
  hashPoemQuery,
  loadMoodLexicon,
  loadPoemRetriever,
  type MoodLexicon,
  type PoemRetriever,
} from "../src/retrieval/poem-retriever.js";
import type { MusicRetrievalTrace } from "../src/retrieval/music-retriever.js";
import type { MusicSpec } from "../src/schema/music-spec.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const DURATION_SECONDS = 180;
const BASELINE_SUFFIX =
  "Instrumental only, no vocals. Target duration: about three minutes (180 seconds).";
const COMPOSE_SUFFIX =
  "\n\nApplication setting for this generation: instrumental only, no vocals; target total duration about three minutes (180 seconds).";

interface Scenario {
  id: string;
  moodGroup: string;
  initialMessage: string;
  underlyingNeed: string;
  evaluatorTurns: string[];
}

interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  mood?: DiscussionMood;
}

interface RetrievalTrace {
  turn: string;
  query: string;
  query_hash: string;
  corpus_version: string;
  reused: boolean;
  retrieved_at: string;
  references: Array<{
    id: string;
    title: string;
    author: string;
    score: number;
    matched_terms: string[];
  }>;
}

/** Everything the Arioso condition produces before Lyria is called. */
interface AriosoPartial {
  transcript: TranscriptTurn[];
  retrievals: RetrievalTrace[];
  brief: string;
  briefSubmitted: string;
  musicSpec: MusicSpec;
  musicRetrievalTrace: MusicRetrievalTrace | null;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function probeDurationSeconds(audioFile: string): number | null {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioFile],
      { encoding: "utf8" },
    ).trim();
    const value = Number.parseFloat(out);
    return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
  } catch {
    return null;
  }
}

async function readScenarios(): Promise<Scenario[]> {
  const text = await readFile(path.join(HERE, "scenarios.json"), "utf8");
  const parsed = JSON.parse(text) as { scenarios: Scenario[] };
  return parsed.scenarios;
}

function parseArgs(argv: string[]): { scenarioId: string; resume: boolean } {
  const index = argv.indexOf("--scenario");
  const scenarioId = index >= 0 ? argv[index + 1] : "01";
  return { scenarioId: scenarioId ?? "01", resume: argv.includes("--resume") };
}

/** Loads the bilingual poem retriever once per language and keeps it cached. */
function createPoemLookup() {
  const retrieverCache = new Map<string, { retriever: PoemRetriever; corpusVersion: string }>();
  let lexicon: MoodLexicon | undefined;

  return async function retrieve(
    turn: string,
    userMessages: string[],
    mood: DiscussionMood | undefined,
  ): Promise<{ references: PoemReference[]; trace: RetrievalTrace }> {
    lexicon ??= await loadMoodLexicon();
    const query = buildPoemQuery({ userMessages, mood }, lexicon);
    const queryHash = hashPoemQuery(query);
    if (!query) {
      return {
        references: [],
        trace: {
          turn, query, query_hash: queryHash, corpus_version: "", reused: false,
          retrieved_at: new Date().toISOString(), references: [],
        },
      };
    }
    const language = detectPoemLanguage(userMessages);
    let loaded = retrieverCache.get(language);
    if (!loaded) {
      const result = await loadPoemRetriever({ language });
      loaded = { retriever: result.retriever, corpusVersion: result.corpusVersion };
      retrieverCache.set(language, loaded);
    }
    const references = loaded.retriever.retrieve(query, 3);
    return {
      references,
      trace: {
        turn,
        query,
        query_hash: queryHash,
        corpus_version: loaded.corpusVersion,
        reused: false,
        retrieved_at: new Date().toISOString(),
        references: references.map((reference) => ({
          id: reference.id,
          title: reference.title,
          author: reference.author,
          score: reference.score,
          matched_terms: reference.matchedTerms,
        })),
      },
    };
  };
}

async function runBaseline(
  config: ReturnType<typeof loadConfig>,
  scenario: Scenario,
  outDir: string,
): Promise<Record<string, unknown>> {
  const prompt = `${scenario.initialMessage}\n\n${BASELINE_SUFFIX}`;
  const dir = path.join(outDir, "condition-a-baseline");
  await mkdir(dir, { recursive: true });
  const audioFile = path.join(dir, "audio.mp3");

  // Reuse a baseline that was already generated for this scenario so repeated
  // runs of the harness do not pay for the same Lyria generation twice.
  let audio: Buffer;
  let generatedText: string | null = null;
  let requestedAt = new Date().toISOString();
  let reused = false;
  try {
    audio = await readFile(audioFile);
    requestedAt = (await stat(audioFile)).mtime.toISOString();
    reused = true;
  } catch {
    const generated = await new LyriaClient(config.geminiApiKey!).generate(prompt, { model: config.lyriaModel });
    audio = generated.audio;
    generatedText = generated.generatedText;
    await writeFile(audioFile, audio);
  }
  const duration = probeDurationSeconds(audioFile);
  return {
    condition: "baseline-direct",
    provider: "google-genai",
    model: config.lyriaModel,
    prompt,
    generatedText,
    requestedAt,
    reused,
    audioFile: path.relative(ROOT, audioFile),
    durationSeconds: duration,
    sha256: sha256(audio),
    failureHistory: [],
  };
}

async function buildAriosoPartial(
  config: ReturnType<typeof loadConfig>,
  scenario: Scenario,
): Promise<AriosoPartial> {
  const retrieve = createPoemLookup();
  const agent = new LangChainDiscussionAgent();
  const options = {
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    language: "zh-CN" as const,
    compositionMode: "single" as const,
    workflowType: "02-music" as const,
  };

  const messages: DiscussionAgentMessage[] = [];
  const transcript: TranscriptTurn[] = [];
  const retrievals: RetrievalTrace[] = [];
  let latestMood: DiscussionMood | undefined;

  const addUserTurn = async (turn: string, content: string) => {
    messages.push({ role: "user", content, images: [] });
    transcript.push({ role: "user", content });
    const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
    const { references, trace } = await retrieve(turn, userMessages, latestMood);
    retrievals.push(trace);
    const reply = await agent.respond(messages, options, references);
    messages.push({ role: "assistant", content: reply.content, images: [] });
    transcript.push({ role: "assistant", content: reply.content, ...(reply.mood ? { mood: reply.mood } : {}) });
    if (reply.mood) latestMood = reply.mood;
    return reply;
  };

  await addUserTurn("initial", scenario.initialMessage);
  for (const [index, turn] of scenario.evaluatorTurns.entries()) {
    await addUserTurn(`turn-${index + 1}`, turn);
  }

  // Proposal: reuse the latest references when the effective context is unchanged.
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const lexicon = await loadMoodLexicon();
  const proposalQuery = buildPoemQuery({ userMessages, mood: latestMood }, lexicon);
  const proposalHash = hashPoemQuery(proposalQuery);
  const lastTrace = [...retrievals].reverse().find((trace) => trace.query_hash === proposalHash);
  let proposalPoems: PoemReference[];
  if (lastTrace) {
    lastTrace.reused = true;
    // Re-read the complete poems behind the reused trace.
    const loaded = await loadPoemRetriever({ language: detectPoemLanguage(userMessages) });
    proposalPoems = loaded.retriever.findByIds(lastTrace.references.map((reference) => reference.id));
  } else {
    const { references, trace } = await retrieve("propose", userMessages, latestMood);
    retrievals.push(trace);
    proposalPoems = references;
  }
  const brief = await agent.propose(messages, options, proposalPoems);
  const briefSubmitted = brief + COMPOSE_SUFFIX;

  // Composer + validated MusicSpec, current automatic music-reference (Auto).
  let musicRetrievalTrace: MusicRetrievalTrace | undefined;
  const spec: MusicSpec = await composeMusic(briefSubmitted, {
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    lyriaModel: config.lyriaModel,
    vocalMode: "instrumental",
    corpusMode: "music",
    onMusicRetrieval: (trace) => {
      musicRetrievalTrace = trace;
    },
  });

  return {
    transcript,
    retrievals,
    brief,
    briefSubmitted,
    musicSpec: spec,
    musicRetrievalTrace: musicRetrievalTrace ?? null,
  };
}

async function runArioso(
  config: ReturnType<typeof loadConfig>,
  scenario: Scenario,
  outDir: string,
  resume: boolean,
): Promise<Record<string, unknown>> {
  const dir = path.join(outDir, "condition-b-arioso");
  await mkdir(dir, { recursive: true });
  const partialPath = path.join(dir, "partial.json");
  const audioFile = path.join(dir, "audio.mp3");

  let partial: AriosoPartial | undefined;
  if (resume) {
    partial = JSON.parse(await readFile(partialPath, "utf8")) as AriosoPartial;
    console.log("  resuming from partial.json (skipping discussion and compose)");
  } else {
    partial = await buildAriosoPartial(config, scenario);
    await writeFile(partialPath, `${JSON.stringify(partial, null, 2)}\n`, "utf8");
    console.log(`  partial state: ${path.relative(ROOT, partialPath)}`);
  }

  const { brief, musicSpec: spec } = partial;

  // Lyria generation. A blocked request is recorded, not silently retried.
  const client = new LyriaClient(config.geminiApiKey!);
  const generatedAt = new Date().toISOString();
  let audio: Buffer;
  let generatedText: string | null = null;
  try {
    const generated = await client.generate(spec.lyriaPrompt, { model: config.lyriaModel });
    audio = generated.audio;
    generatedText = generated.generatedText;
    await writeFile(audioFile, audio);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      path.join(dir, "generation-error.json"),
      `${JSON.stringify({ error: message, lyriaPrompt: spec.lyriaPrompt, generatedAt, attempts: 1 }, null, 2)}\n`,
      "utf8",
    );
    throw error;
  }

  // Automatic review, retained as evidence (it does not decide which audio enters).
  let review: Record<string, unknown>;
  try {
    review = await new GeminiMusicReviewer(config.geminiApiKey!, config.geminiReviewModel).review({
      audio,
      description: brief,
      spec,
      language: "zh-CN",
    });
  } catch (error) {
    review = { error: error instanceof Error ? error.message : String(error) };
  }

  const duration = probeDurationSeconds(audioFile);
  return {
    condition: "arioso-workflow",
    provider: "google-genai",
    model: config.lyriaModel,
    composerModel: config.openAiModel,
    discussionModel: config.openAiModel,
    reviewModel: config.geminiReviewModel,
    transcript: partial.transcript,
    retrievals: partial.retrievals,
    musicRetrievalTrace: partial.musicRetrievalTrace,
    brief,
    briefSubmitted: partial.briefSubmitted,
    musicSpec: spec,
    lyriaPrompt: spec.lyriaPrompt,
    generatedText,
    requestedAt: generatedAt,
    audioFile: path.relative(ROOT, audioFile),
    durationSeconds: duration,
    sha256: sha256(audio),
    automaticReview: review,
    failureHistory: [],
  };
}

async function main(): Promise<void> {
  const { scenarioId, resume } = parseArgs(process.argv.slice(2));
  const scenarios = await readScenarios();
  const scenario = scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario id: ${scenarioId}`);
  }

  const config = loadConfig(true);
  const outDir = path.join(HERE, "runs", `scenario-${scenario.id}`);
  await mkdir(outDir, { recursive: true });

  console.log(`Scenario ${scenario.id} (${scenario.moodGroup})`);
  console.log(`Initial message: ${scenario.initialMessage}`);
  console.log(`Target duration: ${DURATION_SECONDS}s (eval override)`);

  console.log("\n[Condition A] baseline -> Lyria ...");
  const baseline = await runBaseline(config, scenario, outDir);
  console.log(`  audio: ${String(baseline.audioFile)}  duration=${String(baseline.durationSeconds)}s`);

  console.log("\n[Condition B] Arioso workflow ...");
  const arioso = await runArioso(config, scenario, outDir, resume);
  console.log(`  audio: ${String(arioso.audioFile)}  duration=${String(arioso.durationSeconds)}s`);

  // Concealed A/B mapping, randomised per scenario.
  const baselineIsA = Math.random() < 0.5;
  const abMapping = baselineIsA
    ? { A: "baseline", B: "arioso" }
    : { A: "arioso", B: "baseline" };

  const record = {
    protocol: "docs/DH6012-Documentation/DH6012_Eval.md",
    scenario: {
      id: scenario.id,
      moodGroup: scenario.moodGroup,
      initialMessage: scenario.initialMessage,
      underlyingNeed: scenario.underlyingNeed,
      evaluatorTurns: scenario.evaluatorTurns,
    },
    duration: {
      targetSeconds: DURATION_SECONDS,
      note: "Fixed at about three minutes for both conditions by study instruction; the plan otherwise leaves duration uncontrolled.",
    },
    conditions: { baseline, arioso },
    abMapping,
    versions: {
      lyriaModel: config.lyriaModel,
      composerModel: config.openAiModel,
      discussionModel: config.openAiModel,
      reviewModel: config.geminiReviewModel,
    },
    generatedAt: new Date().toISOString(),
  };

  const recordPath = path.join(outDir, "run.json");
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`\nRun record: ${path.relative(ROOT, recordPath)}`);
  console.log(`A/B mapping (concealed): A=${abMapping.A}  B=${abMapping.B}`);
}

main().catch((error: unknown) => {
  console.error(`Evaluation run failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
