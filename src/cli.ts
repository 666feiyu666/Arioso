#!/usr/bin/env node

import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "./composer/composer-agent.js";
import { loadConfig } from "./config/env.js";
import { LyriaClient } from "./lyria/lyria-client.js";
import { stitchAudioFiles } from "./audio/stitch.js";
import { TaskStore, parseTaskInput } from "./web/task-store.js";
import { runAlbumTask } from "./web/server.js";
import { runBackgroundMusicProducer } from "./producer/background-music-producer.js";
import { productionArtifactPath } from "./producer/pipeline.js";

const USAGE = `
Usage:
  pnpm dev compose "<music description>"
  pnpm dev generate "<music description>"
  pnpm dev produce-album "<background music album description>"
  pnpm dev produce-album --resume "<task-id>"
  pnpm dev stitch "<output.wav|mp3>" "<part-1>" "<part-2>" [...more]

Commands:
  compose   Produce and print a validated MusicSpec without calling Lyria.
  generate  Compose a MusicSpec, call Lyria, and save audio plus metadata.
  produce-album  Plan, review, generate, denoise, and export a background music album.
  stitch    Concatenate compatible WAV or MP3 files in order without trimming or overlap.
`.trim();

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return slug.slice(0, 48) || "music";
}

function timestampForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<void> {
  const rawArguments = process.argv.slice(2);
  const argumentsAfterSeparator = rawArguments[0] === "--" ? rawArguments.slice(1) : rawArguments;
  const [command, ...descriptionParts] = argumentsAfterSeparator;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "stitch") {
    const [outputFile, ...inputFiles] = descriptionParts;
    if (!outputFile || inputFiles.length < 2) {
      throw new Error(`An output file and at least two matching WAV or MP3 inputs are required.\n\n${USAGE}`);
    }
    const result = await stitchAudioFiles(outputFile, inputFiles);
    console.log(`Audio: ${result.outputPath}`);
    console.log(
      `Duration: ${result.durationSeconds.toFixed(3)} seconds (${result.segmentDurationsSeconds.map((seconds) => seconds.toFixed(3)).join(" + ")})`,
    );
    console.log(`Format: ${result.sampleRate} Hz, ${result.channels} channels, ${path.extname(result.outputPath).slice(1).toUpperCase()}`);
    return;
  }

  if (command === "produce-album") {
    const config = loadConfig(true);
    const store = new TaskStore(path.resolve(config.outputDirectory, "tasks"));
    // A CLI run must not mark unrelated active browser tasks interrupted.
    await store.initialize({ markInterrupted: false });
    const resume = descriptionParts[0] === "--resume";
    const task = resume ? store.get(descriptionParts[1] ?? "") : await store.create(parseTaskInput({
      description: descriptionParts.join(" "), workflowType: "04-album", produceAlbum: true,
    }), config);
    if (!task?.albumProduction || (resume && !["failed", "completed"].includes(task.status))) {
      throw new Error("Resume requires an idle Background Music Producer task.");
    }
    console.log(`Task: ${task.id}`);
    await runBackgroundMusicProducer(store, task, config, () => runAlbumTask(store, store.get(task.id)!, config));
    const completed = store.get(task.id)!;
    console.log(`Album master: ${productionArtifactPath(store, completed, "audio")}`);
    console.log(`Album video: ${productionArtifactPath(store, completed, "video")}`);
    console.log("Mono denoising completed; compare with the originals before admitting tracks.");
    return;
  }
  if (command !== "compose" && command !== "generate") {
    throw new Error(`Unknown command: ${command}\n\n${USAGE}`);
  }

  const description = descriptionParts.join(" ").trim();
  if (!description) {
    throw new Error(`A music description is required.\n\n${USAGE}`);
  }

  const config = loadConfig(command === "generate");
  const spec = await composeMusic(description, {
    model: config.openAiModel,
    lyriaModel: config.lyriaModel,
  });

  if (command === "compose") {
    console.log(JSON.stringify(spec, null, 2));
    return;
  }

  const lyria = new LyriaClient(config.geminiApiKey!);
  const generated = await lyria.generate(spec.lyriaPrompt, { model: config.lyriaModel });
  const createdAt = new Date();
  const baseName = `${timestampForFile(createdAt)}-${slugify(spec.title)}`;
  const outputDirectory = path.resolve(config.outputDirectory);
  const audioPath = path.join(outputDirectory, `${baseName}.mp3`);
  const metadataPath = path.join(outputDirectory, `${baseName}.json`);

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(audioPath, generated.audio),
    writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          createdAt: createdAt.toISOString(),
          input: description,
          composerModel: config.openAiModel,
          lyriaModel: config.lyriaModel,
          audioFile: path.basename(audioPath),
          generatedText: generated.generatedText,
          musicSpec: spec,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  console.log(`Audio: ${audioPath}`);
  console.log(`Metadata: ${metadataPath}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Arioso failed: ${message}`);
    process.exitCode = 1;
  });
}
