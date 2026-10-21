import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MUSIC_TYPES,
  createMusicRetriever,
  loadMusicCorpus,
  normalizeMusicTitle,
  type NormalizedMusicRecord,
} from "../src/retrieval/music-retriever.js";

function record(
  id: string,
  title: string,
  musicalDescription: string,
  overrides: Partial<NormalizedMusicRecord> = {},
): NormalizedMusicRecord {
  return {
    id,
    title,
    year: null,
    period: "1930s",
    musical_description: musicalDescription,
    normalization_status: "complete",
    source: { article_url: null },
    ...overrides,
  };
}

const styles = [
  record("modal", "Modal jazz", "Spacious modal harmony with slow-moving chords and sparse piano voicings."),
  record("bebop", "Bebop", "Fast angular bebop lines with dense brass attacks."),
  record("cool", "Cool jazz", "Restrained cool jazz ensemble with soft brass and gentle swing."),
];

const standards = [
  record("so-what", "So What", "A slow modal tune built on two chords and a lyrical bass line."),
  record("fast-swing", "Fast Swing", "An energetic 4/4 swing tune with bright brass riffs."),
  record("blues-shuffle", "Blues Shuffle", "A medium-tempo twelve-bar blues with shuffle rhythm."),
  record("unrelated", "Unrelated", "A dense orchestral fanfare with heavy percussion."),
];

describe("music retriever", () => {
  const retriever = createMusicRetriever({
    jazz: { styles, standards },
    blues: {
      styles: [record("delta", "Delta blues", "Slide guitar and a hypnotic repeating riff.")],
      standards: [record("crossroads", "Cross Road Blues", "A solo guitar and vocal blues performance.")],
    },
  });

  it("separates style and standard results within one music type", () => {
    const result = retriever.search({
      musicType: "jazz", mode: "description", query: "sparse modal piano with slow harmony", limit: 5,
    });
    expect(result.mode).toBe("description");
    const kinds = result.references.map((reference) => reference.kind);
    expect(kinds.filter((kind) => kind === "style").length).toBeLessThanOrEqual(2);
    expect(kinds.filter((kind) => kind === "standard").length).toBeLessThanOrEqual(3);
    expect(result.references[0]?.musicType).toBe("jazz");
    expect(result.references.every((reference) => reference.score > 0)).toBe(true);
  });

  it("never exceeds five references and never mixes music types", () => {
    const result = retriever.search({
      musicType: "jazz", mode: "description", query: "jazz swing blues piano guitar brass modal", limit: 20,
    });
    expect(result.references.length).toBeLessThanOrEqual(5);
    expect(result.references.every((reference) => reference.musicType === "jazz")).toBe(true);

    const blues = retriever.search({
      musicType: "blues", mode: "description", query: "slide guitar riff", limit: 5,
    });
    expect(blues.references.every((reference) => reference.musicType === "blues")).toBe(true);
  });

  it("matches works by normalized exact title only", () => {
    const result = retriever.search({ musicType: "jazz", mode: "title", query: "so what", limit: 5 });
    expect(result.mode).toBe("title");
    expect(result.references.map((reference) => reference.id)).toEqual(["so-what"]);
    expect(result.references[0]?.kind).toBe("standard");
  });

  it("reports an evidence gap instead of a similar work", () => {
    const result = retriever.search({ musicType: "jazz", mode: "title", query: "So What Maybe", limit: 5 });
    expect(result.references).toEqual([]);
    expect(result.unavailableReason).toContain("No jazz standard matches");
  });

  it("normalizes case, punctuation, whitespace and diacritics for titles", () => {
    expect(normalizeMusicTitle("  Blue   Mōde ")).toBe("blue mode");
    const local = createMusicRetriever({
      jazz: { styles: [], standards: [record("blue-mode", "Blue Mode", "A slow minor blues.")] },
    });
    expect(local.search({ musicType: "jazz", mode: "title", query: "BLUE MODE!" }).references).toHaveLength(1);
  });

  it("treats auto mode as a title lookup only for a known work", () => {
    const named = retriever.search({ musicType: "jazz", mode: "auto", query: "So What", limit: 5 });
    expect(named.mode).toBe("title");
    const described = retriever.search({ musicType: "jazz", mode: "auto", query: "slow sparse piano", limit: 5 });
    expect(described.mode).toBe("description");
    expect(described.references.length).toBeGreaterThan(0);
  });

  it("omits records without musical evidence", () => {
    const unusable = record("empty", "Empty", "", {
      normalization_status: "insufficient_musical_evidence",
    });
    const local = createMusicRetriever({
      jazz: { styles: [], standards: [unusable, record("usable", "Usable", "A modal jazz piece with sparse piano.")] },
    });
    expect(local.search({ musicType: "jazz", mode: "description", query: "modal piano", limit: 5 })
      .references.map((reference) => reference.id)).toEqual(["usable"]);
  });

  it("returns an explicit unavailable result for an unpopulated type", () => {
    const result = retriever.search({
      musicType: "electronic", mode: "description", query: "evolving pads", limit: 5,
    });
    expect(result.references).toEqual([]);
    expect(result.unavailableReason).toContain("No electronic corpus is configured");
  });
});

describe("music corpus loading", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function writeCorpus(musicType: string, files: { styles?: unknown[]; standards?: unknown[] }) {
    const root = await mkdtemp(path.join(os.tmpdir(), "arioso-music-corpus-"));
    roots.push(root);
    const directory = path.join(root, musicType);
    await mkdir(directory, { recursive: true });
    if (files.styles) {
      await writeFile(
        path.join(directory, "styles.normalized.jsonl"),
        files.styles.map((value) => JSON.stringify(value)).join("\n") + "\n",
        "utf8",
      );
    }
    if (files.standards) {
      await writeFile(
        path.join(directory, "standards.normalized.jsonl"),
        files.standards.map((value) => JSON.stringify(value)).join("\n") + "\n",
        "utf8",
      );
    }
    return root;
  }

  it("resolves recorded reference IDs back into readable summaries", () => {
    const local = createMusicRetriever({
      jazz: {
        styles: [record("modal", "Modal jazz", "Spacious modal harmony.")],
        standards: [record("so-what", "So What", "A slow modal tune.")],
      },
    });
    expect(local.findByIds(["so-what", "modal", "missing", "modal"])).toEqual([
      { id: "so-what", kind: "standard", musicType: "jazz", title: "So What", period: "1930s" },
      { id: "modal", kind: "style", musicType: "jazz", title: "Modal jazz", period: "1930s" },
    ]);
    expect(local.findByIds([])).toEqual([]);
  });

  it("exposes only music types whose collections exist", async () => {
    const root = await writeCorpus("jazz", { styles, standards });
    const { retriever, availability } = await loadMusicCorpus({ root, jazzFallback: undefined });
    expect(retriever.availableTypes()).toEqual(["jazz"]);
    expect(availability.jazz.available).toBe(true);
    for (const musicType of MUSIC_TYPES.slice(1)) {
      expect(availability[musicType].available).toBe(false);
      expect(availability[musicType].reason).toBeTruthy();
    }
  });

  it("reports an incomplete type when only one collection exists", async () => {
    const root = await writeCorpus("blues", { styles });
    const { retriever, availability } = await loadMusicCorpus({ root, jazzFallback: undefined });
    expect(availability.blues).toMatchObject({ available: false, styles: true, standards: false });
    expect(retriever.availableTypes()).not.toContain("blues");
  });

  it("turns a malformed collection into an explicit unavailable reason", async () => {
    const root = await writeCorpus("jazz", { styles, standards: [null] });
    const { availability } = await loadMusicCorpus({ root, jazzFallback: undefined });
    expect(availability.jazz.available).toBe(false);
    expect(availability.jazz.reason).toContain("Invalid music corpus record");
  });

  it("loads the shipped Jazz corpus with both collections", async () => {
    const { retriever, availability } = await loadMusicCorpus({ jazzFallback: undefined });
    expect(availability.jazz).toMatchObject({ available: true, styles: true, standards: true });
    expect(retriever.availableTypes()).toContain("jazz");
    const result = retriever.search({
      musicType: "jazz", mode: "description", query: "slow modal ballad with sparse piano", limit: 5,
    });
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references.every((reference) => reference.musicType === "jazz")).toBe(true);
  });
});
