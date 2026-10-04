import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createJazzRetriever,
  loadJazzRetriever,
  type NormalizedJazzRecord,
} from "../src/retrieval/jazz-retriever.js";

function record(
  id: string,
  title: string,
  musicalDescription: string,
): NormalizedJazzRecord {
  return {
    id,
    title,
    year: null,
    period: "1930s",
    musical_description: musicalDescription,
    normalization_status: "complete",
    source: { article_url: null },
  };
}

describe("jazz retriever", () => {
  const retriever = createJazzRetriever([
    record(
      "minor-waltz",
      "Minor Waltz",
      "A minor-key jazz ballad in 3/4 with a lyrical melody and restrained piano trio accompaniment.",
    ),
    record(
      "fast-swing",
      "Fast Swing",
      "An energetic 4/4 swing tune with bright brass riffs and a walking bass.",
    ),
    record(
      "blues-shuffle",
      "Blues Shuffle",
      "A medium-tempo blues with shuffle rhythm, guitar responses, and a repeated twelve-bar form.",
    ),
    record("cool-jazz", "Cool Jazz", "A restrained cool jazz ensemble with soft brass."),
    record("bebop", "Bebop", "A fast bebop line with angular saxophone phrasing."),
    record("modal", "Modal", "A spacious modal jazz piece with sparse piano voicings."),
  ]);

  it("ranks records by TF-IDF cosine similarity", () => {
    const results = retriever.search("restrained minor jazz piano ballad", 3);

    expect(results[0]?.id).toBe("minor-waltz");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("caps the number of returned references at five", () => {
    const results = retriever.search("jazz swing blues piano guitar brass", 20);

    expect(results).toHaveLength(5);
  });

  it("does not use titles as similarity evidence", () => {
    const localRetriever = createJazzRetriever([
      record(
        "misleading-title",
        "Relaxed Lazy Ballad",
        "An aggressive fast bebop performance with dense brass attacks.",
      ),
      record(
        "matching-description",
        "Unrelated Title",
        "A relaxed lazy jazz ballad with a gentle intimate atmosphere.",
      ),
    ]);

    expect(localRetriever.search("relaxed lazy gentle jazz", 2)[0]?.id).toBe(
      "matching-description",
    );
  });

  it("ignores generic corpus terms and laid-back token noise", () => {
    const localRetriever = createJazzRetriever([
      record(
        "title-noise",
        "Reference One",
        "A jazz standard based on the changes of Back Home Again.",
      ),
      record(
        "audible-match",
        "Reference Two",
        "A relaxed ballad with slow tempo and gentle dynamics.",
      ),
    ]);

    expect(localRetriever.search("laid-back jazz slow gentle", 2)[0]?.id).toBe(
      "audible-match",
    );
  });

  it("returns the requested nearest records even when every score is zero", () => {
    const results = retriever.search("xylophonic-neologism", 3);

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.score === 0)).toBe(true);
  });

  it("omits records without musical evidence", () => {
    const unavailable: NormalizedJazzRecord = {
      ...record("empty", "Empty", ""),
      normalization_status: "insufficient_musical_evidence",
    };
    const localRetriever = createJazzRetriever([
      unavailable,
      record("usable", "Usable", "A modal jazz piece with sparse piano."),
    ]);

    expect(localRetriever.search("modal piano", 5).map((item) => item.id)).toEqual([
      "usable",
    ]);
  });

  it("locates the named song rather than a short description mentioning it", () => {
    const localRetriever = createJazzRetriever([
      record("impressions", "Impressions", "Its chord sequence is identical to So What."),
      record("so-what", "So What", "A modal piece in D Dorian with a bass theme and quartal piano voicings."),
    ]);

    for (const query of ["So What", "so what?", "  Ｓｏ   Ｗｈａｔ？  ", '“So What?”']) {
      expect(localRetriever.search(query, 5)).toEqual([
        expect.objectContaining({ id: "so-what", matchType: "title", score: 1 }),
      ]);
    }
  });

  it("uses an explicit title query without falling back to unrelated descriptions", () => {
    expect(retriever.search("Unknown Minor Ballad", 5, "title")).toEqual([]);
    expect(retriever.search("What", 5, "title")).toEqual([]);
  });

  it("keeps description comparison separate when its query coincides with a title", () => {
    const localRetriever = createJazzRetriever([
      record("named-modal", "Modal", "An energetic blues shuffle with brass riffs."),
      record("modal-evidence", "Another Song", "A spacious modal piece with sparse piano voicings."),
    ]);

    expect(localRetriever.search("modal", 1)[0]?.id).toBe("named-modal");
    expect(localRetriever.search("modal", 1, "description")[0]).toMatchObject({
      id: "modal-evidence", matchType: "description",
    });
  });

  it("returns an incomplete named card with its evidence status", () => {
    const localRetriever = createJazzRetriever([
      { ...record("empty", "Empty", ""), normalization_status: "insufficient_musical_evidence" },
      record("usable", "Usable", "A modal jazz piece with sparse piano."),
    ]);

    expect(localRetriever.search("Empty", 5, "title")).toEqual([
      expect.objectContaining({ id: "empty", musicalDescription: "", normalizationStatus: "insufficient_musical_evidence" }),
    ]);
    expect(localRetriever.search("modal piano", 5, "description").map((item) => item.id)).toEqual(["usable"]);
  });

  it("preserves multiple records with the same title and respects the lookup limit", () => {
    const localRetriever = createJazzRetriever([
      record("one", "Same Title", "A slow blues."),
      record("two", "Same Title", "A fast swing piece."),
    ]);

    expect(localRetriever.search("same title", 5, "title").map((item) => item.id)).toEqual(["one", "two"]);
    expect(localRetriever.search("same title", 1, "title").map((item) => item.id)).toEqual(["one"]);
    expect(localRetriever.search("???", 5, "title")).toEqual([]);
  });
});

describe("jazz corpus loading", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ));
  });

  async function corpusFile(filename = "corpus.jsonl"): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-jazz-loader-"));
    temporaryDirectories.push(directory);
    return path.join(directory, filename);
  }

  it("retries a corpus that becomes available after its first load failed", async () => {
    const corpusPath = await corpusFile();
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", corpusPath);
    await expect(loadJazzRetriever()).rejects.toMatchObject({ code: "ENOENT" });

    await writeFile(corpusPath, JSON.stringify(record("available", "Available", "A modal piano piece.")));
    const loaded = loadJazzRetriever();
    expect(loadJazzRetriever()).toBe(loaded);
    expect((await loaded).search("Available", 5, "title")).toEqual([
      expect.objectContaining({ id: "available" }),
    ]);
  });

  it("uses the configured corpus path instead of a previously cached corpus", async () => {
    const firstPath = await corpusFile("first.jsonl");
    const secondPath = await corpusFile("second.jsonl");
    await writeFile(firstPath, JSON.stringify(record("first", "First", "A piano ballad.")));
    await writeFile(secondPath, JSON.stringify(record("second", "Second", "A brass swing piece.")));

    vi.stubEnv("ARIOSO_JAZZ_CORPUS", firstPath);
    const first = await loadJazzRetriever();
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", secondPath);
    const second = await loadJazzRetriever();
    expect(second.search("Second", 5, "title")[0]?.id).toBe("second");
    expect(second.search("First", 5, "title")).toEqual([]);
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", firstPath);
    expect(await loadJazzRetriever()).toBe(first);
  });

  it("reports the file and original line for invalid JSON and retries after repair", async () => {
    const corpusPath = await corpusFile();
    const validLine = JSON.stringify(record("valid", "Valid", "A gentle ballad."));
    await writeFile(corpusPath, `${validLine}\n\n{invalid}\n`);
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", corpusPath);
    await expect(loadJazzRetriever()).rejects.toThrow(`Invalid JSON in jazz corpus ${corpusPath} at line 3.`);

    await writeFile(corpusPath, `${validLine}\n`);
    expect((await loadJazzRetriever()).search("Valid", 5, "title")[0]?.id).toBe("valid");
  });

  it("rejects malformed records before creating the search index", async () => {
    const corpusPath = await corpusFile();
    await writeFile(corpusPath, JSON.stringify({
      ...record("invalid", "Invalid", "A piano piece."),
      source: { article_url: 42 },
    }));
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", corpusPath);
    await expect(loadJazzRetriever()).rejects.toThrow(`Invalid jazz corpus record in ${corpusPath} at line 1: source.article_url:`);
  });

  it("accepts a UTF-8 BOM and blank lines while preserving source provenance", async () => {
    const corpusPath = await corpusFile();
    const source = {
      article_url: null,
      type: "book",
      author: "Example author",
      license: { redistribution_allowed: false },
      pages: { pdf_start: 10, pdf_end: 11, printed_start: "3", printed_end: "4" },
    };
    await writeFile(corpusPath, `\uFEFF\n${JSON.stringify({
      ...record("provenance", "Provenance", "A restrained piano trio."), source,
    })}\r\n\r\n`);
    vi.stubEnv("ARIOSO_JAZZ_CORPUS", corpusPath);
    const reference = (await loadJazzRetriever()).search("Provenance", 5, "title")[0];
    expect(reference?.source).toEqual(source);
  });
});
