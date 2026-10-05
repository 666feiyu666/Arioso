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

  it("accepts the Jazz corpus workflow", () => {
    expect(parseTaskInput({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "jazz",
      compositionMode: "single",
      workflowType: "02-jazz",
      lyriaModel: "lyria-3-clip-preview",
    })).toEqual({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "jazz",
      compositionMode: "single",
      workflowType: "02-jazz",
      lyriaModel: "lyria-3-clip-preview",
    });
  });

  it("rejects unknown corpus workflows", () => {
    expect(() => parseTaskInput({
      description: "late-night trumpet quartet",
      corpusMode: "automatic",
    })).toThrow("Unsupported corpus mode.");
  });

  it("accepts Jazz without corpus while preserving the workflow", () => {
    expect(parseTaskInput({
      description: 'Create instrumental jazz inspired by "So What".',
      workflowType: "02-jazz",
      corpusMode: "none",
    })).toMatchObject({ workflowType: "02-jazz", corpusMode: "none", compositionMode: "single" });
  });

  it("defaults Jazz requests without an explicit corpus choice to corpus retrieval", () => {
    expect(parseTaskInput({ description: "quiet evening", workflowType: "02-jazz" }))
      .toMatchObject({ corpusMode: "jazz" });
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

  it("accepts an explicitly selected orchestral knowledge card", () => {
    expect(parseTaskInput({
      description: "a five-minute orchestral journey",
      workflowType: "03-orchestral",
      orchestralReferenceId: "dvorak-symphony-no-9",
    })).toMatchObject({
      compositionMode: "orchestral",
      corpusMode: "none",
      orchestralReferenceId: "dvorak-symphony-no-9",
    });
  });

  it("rejects card selection outside the orchestral workflow", () => {
    expect(() => parseTaskInput({
      description: "warm piano",
      orchestralReferenceId: "dvorak-symphony-no-9",
    })).toThrow("Knowledge cards are supported only for orchestral composition.");
  });

  it.each(["../outside", "", null, 42])("rejects invalid card IDs: %s", (id) => {
    expect(() => parseTaskInput({
      description: "an orchestral journey",
      workflowType: "03-orchestral",
      orchestralReferenceId: id,
    })).toThrow("Invalid orchestral knowledge card ID.");
  });

  it("classifies legacy task records without workflow metadata", () => {
    expect(inferWorkflowType({ corpusMode: "none" })).toBe("01-general");
    expect(inferWorkflowType({ retrievalQuery: "modal jazz" })).toBe("02-jazz");
    expect(inferWorkflowType({ compositionMode: "orchestral" })).toBe("03-orchestral");
  });
});
