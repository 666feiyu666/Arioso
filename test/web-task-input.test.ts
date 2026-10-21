import { describe, expect, it } from "vitest";

import { inferWorkflowType, parseTaskInput } from "../src/web/task-store.js";

describe("web task input", () => {
  it.each([null, [], "request", 42])("rejects non-object requests: %j", (value) => {
    expect(() => parseTaskInput(value)).toThrow("A task request is required.");
  });

  it.each([
    [{ mode: "preview" }, "Unsupported task mode."],
    [{ vocalMode: "choir" }, "Unsupported vocal mode."],
    [{ lyriaModel: "unknown-model" }, "Unsupported Lyria model."],
  ])("rejects invalid explicit options: %j", (options, message) => {
    expect(() => parseTaskInput({ description: "warm piano", ...options })).toThrow(message);
  });

  it("defaults existing clients to the no-corpus workflow", () => {
    expect(parseTaskInput({ description: "warm piano", mode: "compose" })).toEqual({
      description: "warm piano",
      mode: "compose",
      vocalMode: "auto",
      corpusMode: "none",
      compositionMode: "single",
      workflowType: "01-general",
    });
  });

  it("accepts the music corpus workflow with a bound music type", () => {
    expect(parseTaskInput({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "music",
      compositionMode: "single",
      workflowType: "02-music",
      musicType: "jazz",
      lyriaModel: "lyria-3-clip-preview",
    })).toEqual({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "music",
      compositionMode: "single",
      workflowType: "02-music",
      musicType: "jazz",
      lyriaModel: "lyria-3-clip-preview",
    });
  });

  it("rejects an unknown music type", () => {
    expect(() => parseTaskInput({
      description: "late-night trumpet quartet", workflowType: "02-music", musicType: "classical",
    })).toThrow("Unsupported music type.");
  });

  it("rejects unknown corpus workflows", () => {
    expect(() => parseTaskInput({
      description: "late-night trumpet quartet",
      corpusMode: "automatic",
    })).toThrow("Unsupported corpus mode.");
  });

  it("accepts the music workflow without corpus while preserving the workflow", () => {
    expect(parseTaskInput({
      description: 'Create instrumental jazz inspired by "So What".',
      workflowType: "02-music",
      corpusMode: "none",
    })).toMatchObject({ workflowType: "02-music", corpusMode: "none", compositionMode: "single" });
  });

  it("defaults music requests without an explicit corpus choice to retrieval", () => {
    expect(parseTaskInput({ description: "quiet evening", workflowType: "02-music" }))
      .toMatchObject({ corpusMode: "music" });
  });

  it("reads the historical 02-jazz workflow as 02-music", () => {
    expect(parseTaskInput({ description: "quiet evening", workflowType: "02-jazz", corpusMode: "jazz" }))
      .toMatchObject({ workflowType: "02-music", corpusMode: "music" });
  });

  it("accepts the orchestral composition workflow", () => {
    expect(parseTaskInput({
      description: "a three-movement work about a river reaching the sea",
      mode: "generate",
      compositionMode: "orchestral",
      workflowType: "03-orchestral",
      lyriaModel: "lyria-3.5",
    })).toEqual({
      description: "a three-movement work about a river reaching the sea",
      mode: "generate",
      vocalMode: "auto",
      corpusMode: "none",
      compositionMode: "orchestral",
      workflowType: "03-orchestral",
      lyriaModel: "lyria-3.5",
    });
  });

  it("accepts album candidates with instrumental defaults and the long-form generation model", () => {
    expect(parseTaskInput({ description: "a concept album", workflowType: "04-album" }))
      .toMatchObject({ compositionMode: "album", vocalMode: "instrumental", corpusMode: "none",
        lyriaModel: "lyria-3.5", candidateCount: 14, targetTotalMinutes: 35 });
  });

  it("accepts a 65-minute album with an expanded candidate batch", () => {
    expect(parseTaskInput({
      description: "morning focus jazz",
      workflowType: "04-album",
      candidateCount: 26,
      targetTotalMinutes: 65,
    })).toMatchObject({ candidateCount: 26, targetTotalMinutes: 65 });
  });

  it.each([11, 29, 13.5, "14"])("rejects invalid album candidate counts: %s", (candidateCount) => {
    expect(() => parseTaskInput({ description: "a concept album", workflowType: "04-album", candidateCount }))
      .toThrow("Album candidate count must be an integer from 12 to 28.");
  });

  it("treats the target duration as advisory instead of coupling it to candidate count", () => {
    expect(parseTaskInput({
      description: "a concept album", workflowType: "04-album", candidateCount: 14, targetTotalMinutes: 65,
    })).toMatchObject({ candidateCount: 14, targetTotalMinutes: 65 });
  });

  it("rejects the clip generation model for albums", () => {
    expect(() => parseTaskInput({ description: "a concept album", workflowType: "04-album", lyriaModel: "lyria-3-clip-preview" }))
      .toThrow("Album generation requires lyria-3.5.");
  });

  it("ignores legacy orchestral reference input instead of injecting it", () => {
    const parsed = parseTaskInput({
      description: "a five-minute orchestral journey",
      workflowType: "03-orchestral",
      orchestralReferenceId: "dvorak-symphony-no-9",
    });
    expect(parsed).toMatchObject({ compositionMode: "orchestral", corpusMode: "none" });
    expect(parsed).not.toHaveProperty("orchestralReferenceId");
  });

  it("classifies legacy task records without workflow metadata", () => {
    expect(inferWorkflowType({ corpusMode: "none" })).toBe("01-general");
    expect(inferWorkflowType({ retrievalQuery: "modal jazz" })).toBe("02-music");
    expect(inferWorkflowType({ workflowType: "02-jazz" })).toBe("02-music");
    expect(inferWorkflowType({ corpusMode: "music" })).toBe("02-music");
    expect(inferWorkflowType({ compositionMode: "orchestral" })).toBe("03-orchestral");
  });
});
