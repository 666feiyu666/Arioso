import { describe, expect, it } from "vitest";

import { inferWorkflowType, parseTaskInput } from "../src/web/server.js";

describe("web task input", () => {
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

  it("rejects composition modes that are not implemented", () => {
    expect(() => parseTaskInput({
      description: "a concept album",
      workflowType: "04-album",
    })).toThrow("Album composition is still in development.");
  });

  it("classifies legacy task records without workflow metadata", () => {
    expect(inferWorkflowType({ corpusMode: "none" })).toBe("01-general");
    expect(inferWorkflowType({ retrievalQuery: "modal jazz" })).toBe("02-jazz");
    expect(inferWorkflowType({ compositionMode: "orchestral" })).toBe("03-orchestral");
  });
});
