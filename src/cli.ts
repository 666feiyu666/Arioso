#!/usr/bin/env node

import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "./composer/composer-agent.js";
import { loadConfig } from "./config/env.js";
import { LyriaClient } from "./lyria/lyria-client.js";

const USAGE = `
Usage:
  pnpm dev compose "<music description>"
  pnpm dev generate "<music description>"

Commands:
  compose   Produce and print a validated MusicSpec without calling Lyria.
  generate  Compose a MusicSpec, call Lyria, and save audio plus metadata.
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
