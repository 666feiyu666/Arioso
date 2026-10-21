#!/usr/bin/env node
// Build the canonical per-type runtime collections from the existing Jazz
// artifacts. This migration step creates no new source data: it only places the
// normalized records under the generic music layout and reports what is missing.
//
//   node src/corpus/build-music-corpus.mjs

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.ARIOSO_MUSIC_CORPUS_ROOT ?? path.join("corpus", "music"));

const TYPES = {
  jazz: {
    styles: ["jazz_genres.normalized.jsonl"],
    standards: ["jazz_standards.combined.normalized.jsonl"],
  },
  blues: { styles: [], standards: [] },
  electronic: { styles: [], standards: [] },
  "instrumental-rock": { styles: [], standards: [] },
  "instrumental-hip-hop": { styles: [], standards: [] },
};

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function writeCollection(directory, output, candidates) {
  for (const candidate of candidates) {
    const source = path.join(directory, candidate);
    if (!(await exists(source))) continue;
    if (candidate === output) return "already-canonical";
    const text = await readFile(source, "utf8");
    await writeFile(path.join(directory, output), text, "utf8");
    return `from ${candidate}`;
  }
  return "missing";
}

let incomplete = 0;
for (const [musicType, collections] of Object.entries(TYPES)) {
  const directory = path.join(ROOT, musicType);
  await mkdir(directory, { recursive: true });
  const styles = await writeCollection(directory, "styles.normalized.jsonl", collections.styles);
  const standards = await writeCollection(directory, "standards.normalized.jsonl", collections.standards);
  if (styles === "missing" || standards === "missing") incomplete += 1;
  console.log(`${musicType}: styles ${styles}, standards ${standards}`);
}
console.log(
  incomplete
    ? `${incomplete} music type(s) still need source collection; they stay unavailable at runtime.`
    : "All music types have canonical collections.",
);
