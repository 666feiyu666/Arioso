// DH6012 end-to-end evaluation: typed music-reference sweep.
//
// Reuses the discussion, brief and baseline audio already produced by
// run-scenario.ts, then binds the Composer to each supported music type and
// generates one Arioso audio per (scenario, type). Automatic review is kept as
// evidence. This replaces the "Auto" music-reference run with an explicit sweep
// of every supported type.
//
// Run from the repository root:
//   npx tsx eval/run-types.ts                      # all four scenarios, all types
//   npx tsx eval/run-types.ts --scenario 01        # one scenario
//   npx tsx eval/run-types.ts --scenario 01 --types jazz
//
// Existing (scenario, type) results are reused so a retry never pays twice.

import "dotenv/config";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "../src/composer/composer-agent.js";
import { loadConfig } from "../src/config/env.js";
import { LyriaClient } from "../src/lyria/lyria-client.js";
import { GeminiMusicReviewer } from "../src/moodmic/music-review.js";
import {
  MUSIC_TYPES,
  type MusicRetrievalTrace,
  type MusicType,
} from "../src/retrieval/music-retriever.js";
import type { MusicSpec } from "../src/schema/music-spec.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

interface Scenario {
  id: string;
  moodGroup: string;
  initialMessage: string;
  underlyingNeed: string;
  evaluatorTurns: string[];
}

interface AriosoPartial {
  transcript: unknown;
  retrievals: unknown;
  brief: string;
  briefSubmitted: string;
  musicSpec: MusicSpec;
  musicRetrievalTrace: MusicRetrievalTrace | null;
}

interface BaselineRecord {
  condition: string;
  prompt: string;
  audioFile: string;
  durationSeconds: number | null;
  sha256: string;
  reused?: boolean;
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

function parseArgs(argv: string[]) {
  const scenarioIndex = argv.indexOf("--scenario");
  const typeIndex = argv.indexOf("--types");
  const scenario = scenarioIndex >= 0 ? argv[scenarioIndex + 1] : undefined;
  const types = typeIndex >= 0 ? argv[typeIndex + 1] : undefined;
  return {
    scenario: scenario ?? undefined,
    types: types ? types.split(",").map((entry) => entry.trim()).filter(Boolean) as MusicType[] : [...MUSIC_TYPES] as MusicType[],
  };
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function generateForType(
  config: ReturnType<typeof loadConfig>,
  scenario: Scenario,
  partial: AriosoPartial,
  type: MusicType,
  outDir: string,
): Promise<Record<string, unknown>> {
  const dir = path.join(outDir, `condition-b-${type}`);
  await mkdir(dir, { recursive: true });
  const audioFile = path.join(dir, "audio.mp3");
  const specPath = path.join(dir, "spec.json");
  const resultPath = path.join(dir, "result.json");
  const errorPath = path.join(dir, "generation-error.json");

  const existing = await readJson<Record<string, unknown>>(resultPath);
  if (existing) {
    return { ...existing, reused: true };
  }

  // Composer bound to this music type (selectionSource "interface"). If a
  // previous attempt composed but failed at generation, reuse that exact spec
  // so a retry tests the same prompt instead of composing a new one.
  const tracePath = path.join(dir, "trace.json");
  let musicRetrievalTrace: MusicRetrievalTrace | undefined;
  let spec: MusicSpec;
  const savedSpec = await readJson<MusicSpec>(specPath);
  if (savedSpec) {
    spec = savedSpec;
    musicRetrievalTrace = await readJson<MusicRetrievalTrace>(tracePath);
  } else {
    spec = await composeMusic(partial.briefSubmitted, {
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      lyriaModel: config.lyriaModel,
      vocalMode: "instrumental",
      corpusMode: "music",
      musicType: type,
      onMusicRetrieval: (trace) => {
        musicRetrievalTrace = trace;
      },
    });
    await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    if (musicRetrievalTrace) {
      await writeFile(tracePath, `${JSON.stringify(musicRetrievalTrace, null, 2)}\n`, "utf8");
    }
  }

  const requestedAt = new Date().toISOString();
  let audio: Buffer;
  let generatedText: string | null = null;
  try {
    const generated = await new LyriaClient(config.geminiApiKey!).generate(spec.lyriaPrompt, {
      model: config.lyriaModel,
    });
    audio = generated.audio;
    generatedText = generated.generatedText;
    await writeFile(audioFile, audio);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      errorPath,
      `${JSON.stringify({ error: message, musicType: type, lyriaPrompt: spec.lyriaPrompt, requestedAt }, null, 2)}\n`,
      "utf8",
    );
    return {
      condition: `arioso-${type}`,
      musicType: type,
      error: message,
      musicRetrievalTrace: musicRetrievalTrace ?? null,
      musicSpec: spec,
      lyriaPrompt: spec.lyriaPrompt,
      requestedAt,
      audioFile: null,
      durationSeconds: null,
      sha256: null,
      failureHistory: [message],
    };
  }

  let review: Record<string, unknown>;
  try {
    review = await new GeminiMusicReviewer(config.geminiApiKey!, config.geminiReviewModel).review({
      audio,
      description: partial.brief,
      spec,
      language: "zh-CN",
    });
  } catch (error) {
    review = { error: error instanceof Error ? error.message : String(error) };
  }

  const duration = probeDurationSeconds(audioFile);
  const result: Record<string, unknown> = {
    condition: `arioso-${type}`,
    provider: "google-genai",
    model: config.lyriaModel,
    composerModel: config.openAiModel,
    reviewModel: config.geminiReviewModel,
    musicType: type,
    musicRetrievalTrace: musicRetrievalTrace ?? null,
    brief: partial.brief,
    briefSubmitted: partial.briefSubmitted,
    musicSpec: spec,
    lyriaPrompt: spec.lyriaPrompt,
    generatedText,
    requestedAt,
    audioFile: path.relative(ROOT, audioFile),
    durationSeconds: duration,
    sha256: sha256(audio),
    automaticReview: review,
    failureHistory: [],
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scenariosFile = await readFile(path.join(HERE, "scenarios.json"), "utf8");
  const scenarios = (JSON.parse(scenariosFile) as { scenarios: Scenario[] }).scenarios;
  const selected = args.scenario
    ? scenarios.filter((scenario) => scenario.id === args.scenario)
    : scenarios;
  if (!selected.length) throw new Error(`Unknown scenario: ${args.scenario}`);

  const config = loadConfig(true);

  for (const scenario of selected) {
    const outDir = path.join(HERE, "runs", `scenario-${scenario.id}`);
    const run = await readJson<{ conditions: { baseline: BaselineRecord } }>(path.join(outDir, "run.json"));
    if (!run) throw new Error(`Missing run.json for scenario ${scenario.id}; run run-scenario.ts first.`);
    const partial = await readJson<AriosoPartial>(path.join(outDir, "condition-b-arioso", "partial.json"));
    if (!partial) throw new Error(`Missing partial.json for scenario ${scenario.id}; run run-scenario.ts first.`);

    console.log(`\nScenario ${scenario.id} (${scenario.moodGroup}) · types: ${args.types.join(", ")}`);
    const typed: Record<string, unknown> = {};
    for (const type of args.types) {
      process.stdout.write(`  - ${type} ...`);
      try {
        const result = await generateForType(config, scenario, partial, type, outDir);
        typed[type] = result;
        const reused = result.reused === true;
        const ok = result.error === undefined;
        console.log(
          ` ${reused ? "reused" : "done"} duration=${String(result.durationSeconds)}s` +
          ` review=${(result.automaticReview as { verdict?: string } | undefined)?.verdict ?? "n/a"}` +
          (ok ? "" : ` ERROR=${String(result.error)}`),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        typed[type] = { error: message };
        console.log(` ERROR ${message}`);
      }
    }

    const recordPath = path.join(outDir, "run-types.json");
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
        targetSeconds: 180,
        note: "Fixed at about three minutes for every condition by study instruction.",
      },
      musicReference: {
        mode: "typed-sweep",
        note: "Supersedes the earlier Auto run in condition-b-arioso/. The Composer is bound to each supported type (selectionSource interface); no Auto, no None.",
        types: args.types,
      },
      baseline: run.conditions.baseline,
      typed,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    console.log(`  record: ${path.relative(ROOT, recordPath)}`);
  }
}

main().catch((error: unknown) => {
  console.error(`Typed sweep failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
