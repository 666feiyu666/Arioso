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
});
