import { describe, expect, it } from "vitest";

import { parseTaskInput } from "../src/web/server.js";

describe("web task input", () => {
  it("defaults existing clients to the no-corpus workflow", () => {
    expect(parseTaskInput({ description: "warm piano", mode: "compose" })).toEqual({
      description: "warm piano",
      mode: "compose",
      vocalMode: "auto",
      corpusMode: "none",
    });
  });

  it("accepts the Jazz corpus workflow", () => {
    expect(parseTaskInput({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "jazz",
      lyriaModel: "lyria-3-clip-preview",
    })).toEqual({
      description: "late-night trumpet quartet",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "jazz",
      lyriaModel: "lyria-3-clip-preview",
    });
  });

  it("rejects unknown corpus workflows", () => {
    expect(() => parseTaskInput({
      description: "late-night trumpet quartet",
      corpusMode: "automatic",
    })).toThrow("Unsupported corpus mode.");
  });
});
