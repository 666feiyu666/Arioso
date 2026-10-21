import { describe, expect, it } from "vitest";

import { createMusicRetriever, type NormalizedMusicRecord } from "../src/retrieval/music-retriever.js";
import { musicReferencesForTask, musicReferencesForTrace } from "../src/web/music-references.js";

function record(id: string, title: string): NormalizedMusicRecord {
  return {
    id,
    title,
    year: null,
    period: "1950s",
    musical_description: `${title} description.`,
    normalization_status: "complete",
    source: { article_url: null },
  };
}

const retriever = createMusicRetriever({
  jazz: {
    styles: [record("style-modal", "Modal jazz")],
    standards: [record("standard-so-what", "So What")],
  },
});

describe("music references shown in the interface", () => {
  it("resolves style and standard IDs into titles", () => {
    expect(musicReferencesForTrace({
      musicType: "jazz",
      selectionSource: "composer",
      query: "modal piano",
      mode: "description",
      styleReferenceIds: ["style-modal"],
      standardReferenceIds: ["standard-so-what"],
    }, retriever)).toEqual([
      { id: "style-modal", kind: "style", musicType: "jazz", title: "Modal jazz", period: "1950s" },
      { id: "standard-so-what", kind: "standard", musicType: "jazz", title: "So What", period: "1950s" },
    ]);
  });

  it("drops IDs the current corpus no longer contains", () => {
    expect(musicReferencesForTrace({
      musicType: "jazz",
      selectionSource: "composer",
      query: "modal piano",
      mode: "description",
      styleReferenceIds: ["gone"],
      standardReferenceIds: ["standard-so-what"],
    }, retriever)).toEqual([
      { id: "standard-so-what", kind: "standard", musicType: "jazz", title: "So What", period: "1950s" },
    ]);
  });

  it("returns nothing when the trace recorded no references", () => {
    expect(musicReferencesForTrace(undefined, retriever)).toEqual([]);
    expect(musicReferencesForTrace({
      musicType: "jazz",
      selectionSource: "composer",
      query: "modal piano",
      mode: "description",
      styleReferenceIds: [],
      standardReferenceIds: [],
    }, retriever)).toEqual([]);
  });

  it("distinguishes a task that used no corpus from one whose references are gone", async () => {
    expect(await musicReferencesForTask({}, async () => ({ retriever }))).toBeUndefined();
    expect(await musicReferencesForTask({
      musicRetrieval: {
        musicType: "jazz",
        selectionSource: "composer",
        query: "modal piano",
        mode: "description",
        styleReferenceIds: ["gone"],
        standardReferenceIds: [],
      },
    }, async () => ({ retriever }))).toEqual([]);
  });

  it("stays advisory when the corpus cannot be loaded", async () => {
    const task = {
      musicRetrieval: {
        musicType: "jazz" as const,
        selectionSource: "composer" as const,
        query: "modal piano",
        mode: "description" as const,
        styleReferenceIds: ["style-modal"],
        standardReferenceIds: [],
      },
    };
    expect(await musicReferencesForTask(task, async () => {
      throw new Error("corpus unreadable");
    })).toEqual([]);
  });
});
