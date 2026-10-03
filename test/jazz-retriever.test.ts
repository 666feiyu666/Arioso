import { describe, expect, it } from "vitest";

import {
  createJazzRetriever,
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
