import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildPoemQuery,
  createPoemRetriever,
  hashPoemQuery,
  loadMoodLexicon,
  loadPoemRetriever,
  MIN_POEM_RELEVANCE,
  moodExpansions,
  parsePoemRecords,
  tokenizePoemText,
  type MoodLexicon,
  type NormalizedPoemRecord,
} from "../src/retrieval/poem-retriever.js";

const LEXICON: MoodLexicon = {
  version: "test",
  categories: {
    lonely: ["lonely", "solitude", "孤独", "寂寞", "寂寥"],
    calm: ["calm", "still", "平静", "静谧"],
    joyful: ["joyful", "bright", "喜悦", "明亮"],
  },
  singleCharacterTokens: ["雨", "月"],
  stopTerms: ["the", "and", "一个"],
};

function record(overrides: Partial<NormalizedPoemRecord> = {}): NormalizedPoemRecord {
  return {
    schema_version: "1.0",
    id: "modern-poem-a",
    title: "雨巷",
    author: "戴望舒",
    date: null,
    text: "撑着油纸伞，独自彷徨在悠长、悠长又寂寥的雨巷",
    search_text: "撑着油纸伞，独自彷徨在悠长、悠长又寂寥的雨巷",
    matched_mood_cues: ["寂寥", "孤独"],
    source: { repository: "sheepzh/poetry", commit: "abc", path: "data/戴望舒_daiwangshu/雨巷.pt" },
    ...overrides,
  };
}

describe("poem tokenizer", () => {
  it("builds Chinese character bigrams and trigrams without punctuation", () => {
    const tokens = tokenizePoemText("雨巷，寂寥的夜", LEXICON);
    expect(tokens).toContain("雨巷");
    expect(tokens).toContain("寂寥");
    expect(tokens).toContain("寂寥的");
    expect(tokens.some((token) => token.includes("，"))).toBe(false);
  });

  it("keeps Latin words and drops stop terms", () => {
    const tokens = tokenizePoemText("the neon rain 1928", LEXICON);
    expect(tokens).toContain("neon");
    expect(tokens).toContain("rain");
    expect(tokens).toContain("1928");
    expect(tokens).not.toContain("the");
  });

  it("allows single characters only from the lexicon allowlist", () => {
    const tokens = tokenizePoemText("雨夜月光", LEXICON);
    expect(tokens).toContain("雨");
    expect(tokens).toContain("月");
    expect(tokens).not.toContain("夜");
  });
});

describe("poem query construction", () => {
  it("expands a Chinese mood label into its category vocabulary", () => {
    expect(moodExpansions("今晚有点孤独", LEXICON)).toEqual(
      expect.arrayContaining(["lonely", "solitude", "孤独", "寂寞", "寂寥"]),
    );
  });

  it("bridges English user input to Chinese cues", () => {
    const expansions = moodExpansions("I feel lonely and bright", LEXICON);
    expect(expansions).toContain("孤独");
    expect(expansions).toContain("喜悦");
  });

  it("combines user messages with the latest mood", () => {
    const query = buildPoemQuery({
      userMessages: ["Something for a rainy walk home", "Not too sad"],
      mood: { label: "lonely", imagery: "a wet street at night" },
    }, LEXICON);
    expect(query).toContain("rainy walk home");
    expect(query).toContain("wet street at night");
    expect(query).toContain("孤独");
  });

  it("returns an empty query when there is nothing to search", () => {
    expect(buildPoemQuery({ userMessages: [], mood: undefined }, LEXICON)).toBe("");
  });
});

describe("poem retrieval", () => {
  const corpus = [
    record(),
    record({
      id: "modern-poem-b",
      title: "雨夜",
      author: "北岛",
      text: "雨夜的城市像一条沉默的河",
      search_text: "雨夜的城市像一条沉默的河",
      matched_mood_cues: ["孤独"],
    }),
    record({
      id: "modern-poem-c",
      title: "远方",
      author: "戴望舒",
      text: "远方有雨，有寂寥的脚步声",
      search_text: "远方有雨，有寂寥的脚步声",
      matched_mood_cues: ["寂寥"],
    }),
    record({
      id: "modern-poem-d",
      title: "晴日",
      author: "林徽因",
      text: "明亮的阳光落在窗台上",
      search_text: "明亮的阳光落在窗台上",
      matched_mood_cues: ["喜悦"],
    }),
  ];

  it("returns at most three positive-score poems from distinct authors", () => {
    const retriever = createPoemRetriever(corpus, { lexicon: LEXICON });
    const results = retriever.retrieve("孤独寂寞的雨巷");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(new Set(results.map((result) => result.author)).size).toBe(results.length);
    for (const result of results) expect(result.score).toBeGreaterThan(0);
  });

  it("keeps the strongest poem for the strongest imagery", () => {
    const retriever = createPoemRetriever(corpus, { lexicon: LEXICON });
    const results = retriever.retrieve("寂寥的雨巷 独自彷徨");
    expect(results[0]?.id).toBe("modern-poem-a");
  });

  it("returns the complete poem text without stanza truncation", () => {
    const long = `${"雨巷的夜色。".repeat(400)}\n\n最后一行`;
    const retriever = createPoemRetriever([record({ text: long, search_text: long })], { lexicon: LEXICON });
    const [result] = retriever.retrieve("雨巷");
    expect(result?.text).toBe(long);
  });

  it("produces the same ranking for the same corpus and query", () => {
    const first = createPoemRetriever(corpus, { lexicon: LEXICON }).retrieve("雨 寂寥 孤独");
    const second = createPoemRetriever(corpus, { lexicon: LEXICON }).retrieve("雨 寂寥 孤独");
    expect(first.map((result) => result.id)).toEqual(second.map((result) => result.id));
  });

  it("drops zero-score results instead of padding the list", () => {
    const retriever = createPoemRetriever(corpus, { lexicon: LEXICON });
    expect(retriever.retrieve("量子计算机编译器")).toEqual([]);
    expect(retriever.retrieve("")).toEqual([]);
  });

  it("breaks score ties by stable record id", () => {
    const duplicateContent = [
      record({ id: "modern-poem-zzz", author: "甲", title: "同题", text: "同样的句子在夜里", search_text: "同样的句子在夜里" }),
      record({ id: "modern-poem-aaa", author: "乙", title: "同题", text: "同样的句子在夜里", search_text: "同样的句子在夜里" }),
    ];
    const results = createPoemRetriever(duplicateContent, { lexicon: LEXICON }).retrieve("夜里");
    expect(results.map((result) => result.id)).toEqual(["modern-poem-aaa", "modern-poem-zzz"]);
  });

  it("records the query terms that matched", () => {
    const retriever = createPoemRetriever(corpus, { lexicon: LEXICON });
    const [result] = retriever.retrieve("寂寥的雨巷");
    expect(result?.matchedTerms).toEqual(expect.arrayContaining(["寂寥", "雨巷"]));
  });

  it("drops matches below the relevance floor instead of padding the list", () => {
    const strict = createPoemRetriever(corpus, { lexicon: LEXICON, minRelevance: 0.9 });
    expect(strict.retrieve("寂寥的雨巷")).toEqual([]);
    const relaxed = createPoemRetriever(corpus, { lexicon: LEXICON, minRelevance: 0 });
    expect(relaxed.retrieve("寂寥的雨巷").length).toBeGreaterThan(0);
    expect(MIN_POEM_RELEVANCE).toBeGreaterThan(0);
  });

  it("re-reads complete poems for stored reference ids, in order", () => {
    const retriever = createPoemRetriever(corpus, { lexicon: LEXICON });
    const records = retriever.findByIds(["modern-poem-c", "modern-poem-missing", "modern-poem-a"]);
    expect(records.map((record) => record.id)).toEqual(["modern-poem-c", "modern-poem-a"]);
    expect(records[1]?.text).toBe(corpus[0]?.text);
  });
});

describe("poem query identity", () => {
  it("hashes the trimmed query deterministically", () => {
    expect(hashPoemQuery("  孤独的雨  ")).toBe(hashPoemQuery("孤独的雨"));
    expect(hashPoemQuery("孤独的雨")).not.toBe(hashPoemQuery("孤独的 雨"));
  });

  it("changes as soon as the user context changes", () => {
    const first = hashPoemQuery(buildPoemQuery({ userMessages: ["A rainy street"] }, LEXICON));
    const second = hashPoemQuery(buildPoemQuery({ userMessages: ["A rainy street", "Warmer"] }, LEXICON));
    expect(first).not.toBe(second);
  });
});

describe("poem corpus loading", () => {
  let root = "";

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "arioso-poem-corpus-"));
    await mkdir(root, { recursive: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeCorpus(lines: string[], checksum?: string): Promise<{ corpus: string; manifest: string }> {
    const corpus = path.join(root, "modern_poems.normalized.jsonl");
    const manifest = path.join(root, "modern_poems.manifest.json");
    const text = `${lines.join("\n")}\n`;
    await writeFile(corpus, text, "utf8");
    await writeFile(manifest, JSON.stringify({
      checksum: { value: checksum ?? createHash("sha256").update(text, "utf8").digest("hex") },
    }), "utf8");
    return { corpus, manifest };
  }

  it("skips malformed records instead of failing the corpus", async () => {
    const { corpus, manifest } = await writeCorpus([
      JSON.stringify(record()),
      "{not json",
      JSON.stringify({ id: "broken" }),
    ]);
    const loaded = await loadPoemRetriever({ corpusPath: corpus, manifestPath: manifest, lexicon: LEXICON });
    expect(loaded.rejectedRecords).toBe(2);
    expect(loaded.retriever.retrieve("雨巷").length).toBe(1);
  });

  it("rejects a corpus whose checksum does not match the manifest", async () => {
    const { corpus, manifest } = await writeCorpus([JSON.stringify(record())], "0".repeat(64));
    await expect(
      loadPoemRetriever({ corpusPath: corpus, manifestPath: manifest, lexicon: LEXICON }),
    ).rejects.toThrow(/checksum/u);
  });

  it("rejects an empty corpus", async () => {
    const { corpus, manifest } = await writeCorpus([]);
    await expect(
      loadPoemRetriever({ corpusPath: corpus, manifestPath: manifest, lexicon: LEXICON }),
    ).rejects.toThrow(/no valid records/u);
  });

  it("parses the checked-in modern-poetry corpus with reproducible provenance", async () => {
    const corpusPath = path.resolve("corpus", "poem", "Chinese", "modern_poems.normalized.jsonl");
    const text = await readFile(corpusPath, "utf8");
    const { records, rejected } = parsePoemRecords(text);
    expect(rejected).toBe(0);
    expect(records.length).toBeGreaterThanOrEqual(500);
    expect(new Set(records.map((item) => item.id)).size).toBe(records.length);
    for (const item of records) {
      expect(item.source.repository).toBe("sheepzh/poetry");
      expect(item.source.commit).toMatch(/^[a-f0-9]{40}$/u);
      expect(item.source.path).toMatch(/^data\//u);
      expect(item.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("matches the shipped manifest checksum and counts", async () => {
    const corpusPath = path.resolve("corpus", "poem", "Chinese", "modern_poems.normalized.jsonl");
    const text = await readFile(corpusPath, "utf8");
    const manifest = JSON.parse(
      await readFile(path.resolve("corpus", "poem", "Chinese", "modern_poems.manifest.json"), "utf8"),
    ) as { checksum: { value: string }; corpus_count: number; meets_minimum: boolean; authors: Record<string, number> };
    expect(manifest.checksum.value).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    expect(manifest.meets_minimum).toBe(true);
    const { records } = parsePoemRecords(text);
    expect(manifest.corpus_count).toBe(records.length);
    const perAuthor: Record<string, number> = {};
    for (const item of records) perAuthor[item.author] = (perAuthor[item.author] ?? 0) + 1;
    expect(perAuthor).toEqual(manifest.authors);
  });

  it("answers Chinese and English mood queries from the real corpus", async () => {
    const loaded = await loadPoemRetriever({ lexicon: LEXICON });
    const lexicon = await loadMoodLexicon();
    const cases = [
      { userMessages: ["今晚有点孤独"], mood: { label: "孤独", imagery: "下着雨的巷子" } },
      { userMessages: ["I feel lonely tonight"], mood: { label: "lonely", imagery: "a rainy street at night" } },
      { userMessages: ["Something calm and bright"], mood: { label: "calm", imagery: "a bright morning" } },
    ];
    for (const input of cases) {
      const query = buildPoemQuery(input, lexicon);
      const results = loaded.retriever.retrieve(query);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      expect(new Set(results.map((result) => result.author)).size).toBe(results.length);
    }
  });
});

// A fixed evaluation set for the Director: ordinary emotional turns must reach a
// poem, generic filler must not. The floor in `poem-retriever.ts` is calibrated
// against these two lists, so changing either one requires re-calibration.
describe("fixed Director evaluation set", () => {
  const emotional = [
    "感到很难过",
    "今晚有点孤独",
    "焦虑得睡不着",
    "想要平静、干净的声音",
    "今天很开心，想庆祝",
    "有点愤怒，想爆发",
    "又平静又难过",
    "想起小时候的故乡",
  ];
  const generic = ["感到", "帮我做一首歌，越快越好", "今天", "我很"];

  it("expands 难过 into the sad group without a prior Director mood", async () => {
    const lexicon = await loadMoodLexicon();
    const query = buildPoemQuery({ userMessages: ["感到很难过"] }, lexicon);
    expect(moodExpansions("感到很难过", lexicon)).toEqual(
      expect.arrayContaining(["难过", "伤心", "悲伤", "惆怅", "melancholy"]),
    );
    expect(query).toContain("难过");
    expect(query).toContain("悲伤");
  });

  it("reaches a poem for every emotional case", async () => {
    const lexicon = await loadMoodLexicon();
    const { retriever } = await loadPoemRetriever();
    for (const text of emotional) {
      const results = retriever.retrieve(buildPoemQuery({ userMessages: [text] }, lexicon));
      expect(results.length, text).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
    }
  });

  it("returns nothing when the overlap is only filler vocabulary", async () => {
    const lexicon = await loadMoodLexicon();
    const { retriever } = await loadPoemRetriever();
    for (const text of generic) {
      expect(retriever.retrieve(buildPoemQuery({ userMessages: [text] }, lexicon)), text).toEqual([]);
    }
  });
});
