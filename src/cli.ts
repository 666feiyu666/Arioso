#!/usr/bin/env node

import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "./composer/composer-agent.js";
import { loadConfig } from "./config/env.js";
import { LyriaClient } from "./lyria/lyria-client.js";
import { stitchWavFiles } from "./audio/stitch.js";

const USAGE = `
Usage:
  pnpm dev compose "<music description>"
  pnpm dev generate "<music description>"
  pnpm dev stitch "<output.wav>" "<part-1.wav>" "<part-2.wav>" [...more.wav]

Commands:
  compose   Produce and print a validated MusicSpec without calling Lyria.
  generate  Compose a MusicSpec, call Lyria, and save audio plus metadata.
  stitch    Concatenate two or more complete WAV files in order without trimming or overlap.
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
      throw new Error(`An output WAV and at least two input WAV files are required.\n\n${USAGE}`);
    }
    const result = await stitchWavFiles(outputFile, inputFiles);
    console.log(`Audio: ${result.outputPath}`);
    console.log(
      `Duration: ${result.durationSeconds.toFixed(3)} seconds (${result.segmentDurationsSeconds.map((seconds) => seconds.toFixed(3)).join(" + ")})`,
    );
    console.log(`Format: ${result.sampleRate} Hz, ${result.channels} channels, 16-bit PCM WAV`);
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
