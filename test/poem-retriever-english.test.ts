import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPoemQuery,
  detectPoemLanguage,
  loadMoodLexicon,
  loadPoemRetriever,
  parsePoemRecords,
  tokenizePoemText,
  type MoodLexicon,
} from "../src/retrieval/poem-retriever.js";

const LEXICON: MoodLexicon = {
  version: "test",
  categories: {
    sad: ["sad", "sorrow", "lonely"],
    joyful: ["joyful", "bright"],
  },
  singleCharacterTokens: [],
  stopTerms: ["the", "and", "of", "a"],
};

describe("English poem tokenizer", () => {
  it("strips common inflections to a shared stem", () => {
    const tokens = tokenizePoemText("walking walked walks birds bright", LEXICON);
    expect(tokens).toContain("walk");
    expect(tokens).toContain("bird");
    expect(tokens).toContain("bright");
  });

  it("keeps numbers and drops stop words", () => {
    const tokens = tokenizePoemText("the 1928 rain of and", LEXICON);
    expect(tokens).toContain("1928");
    expect(tokens).toContain("rain");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("of");
    expect(tokens).not.toContain("and");
  });
});

describe("poem corpus language detection", () => {
  it("chooses zh for Chinese messages and en for English ones", () => {
    expect(detectPoemLanguage(["今晚有点孤独"])).toBe("zh");
    expect(detectPoemLanguage(["I feel lonely tonight"])).toBe("en");
    expect(detectPoemLanguage(["calm and peaceful"])).toBe("en");
  });

  it("falls back to zh when there is nothing to detect", () => {
    expect(detectPoemLanguage([])).toBe("zh");
  });
});

describe("English poem corpus", () => {
  it("parses the checked-in English corpus with reproducible provenance", async () => {
    const corpusPath = path.resolve("corpus", "poem", "English", "english_poems.normalized.jsonl");
    const text = await readFile(corpusPath, "utf8");
    const { records, rejected } = parsePoemRecords(text);
    expect(rejected).toBe(0);
    expect(records.length).toBeGreaterThanOrEqual(300);
    expect(new Set(records.map((item) => item.id)).size).toBe(records.length);
    for (const item of records) {
      expect(item.source.repository).toBe("Wang-Haining/fine-grained-poetry-interpretation");
      expect(item.source.path).toBe("sample.csv");
      expect(item.text.trim().length).toBeGreaterThan(0);
      expect(item.matched_mood_cues.length).toBeGreaterThan(0);
    }
  });

  it("matches the shipped manifest checksum and counts", async () => {
    const corpusPath = path.resolve("corpus", "poem", "English", "english_poems.normalized.jsonl");
    const text = await readFile(corpusPath, "utf8");
    const manifest = JSON.parse(
      await readFile(path.resolve("corpus", "poem", "English", "english_poems.manifest.json"), "utf8"),
    ) as { checksum: { value: string }; corpus_count: number; meets_minimum: boolean };
    expect(manifest.checksum.value).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    expect(manifest.meets_minimum).toBe(true);
    const { records } = parsePoemRecords(text);
    expect(manifest.corpus_count).toBe(records.length);
  });

  it("reaches a poem for English mood queries via emotion-tag cues", async () => {
    const loaded = await loadPoemRetriever({ language: "en" });
    const lexicon = await loadMoodLexicon();
    const cases = [
      { userMessages: ["I feel lonely tonight"], mood: { label: "lonely", imagery: "a rainy street at night" } },
      { userMessages: ["Something joyful and bright"], mood: { label: "joyful", imagery: "a bright morning" } },
      { userMessages: ["Calm and peaceful"], mood: { label: "calm", imagery: "a still lake" } },
    ];
    for (const input of cases) {
      const query = buildPoemQuery(input, lexicon);
      const results = loaded.retriever.retrieve(query);
      expect(results.length, query).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      expect(new Set(results.map((result) => result.author)).size).toBe(results.length);
    }
  });
});
