import { describe, expect, it } from "vitest";

import { heuristicClassify } from "../src/web/mood-classifier.js";
import { withWebServer } from "./helpers/web-server.js";

describe("heuristic mood classification", () => {
  it("reads Chinese and English feeling words into a colour group", () => {
    expect(heuristicClassify("最近总是很紧张，有点焦虑")).toMatchObject({ group: "coral", emotion: "anxious" });
    expect(heuristicClassify("I feel so tired and drained today")).toMatchObject({ group: "blue", emotion: "drained" });
    expect(heuristicClassify("今天心情很平静，也很放松")).toMatchObject({ group: "sage", emotion: "calm" });
    expect(heuristicClassify("特别开心")).toMatchObject({ group: "gold", emotion: "joyful" });
  });

  it("returns no suggestion when the text carries no feeling", () => {
    expect(heuristicClassify("明天天气怎么样？")).toMatchObject({ group: null, emotion: null, source: "heuristic" });
    expect(heuristicClassify("")).toMatchObject({ group: null, emotion: null });
  });
});

describe("web mood classification API", () => {
  it("falls back to the offline lexicon when no model is configured", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/mood-entries/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "今天有点孤单，也有点累" }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.source).toBe("heuristic");
      expect(["lonely", "drained"]).toContain(body.emotion);
      expect(["blue"]).toContain(body.group);
    });
  });

  it("uses an injected classifier and lets the user see the suggestion source", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/mood-entries/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "anything" }),
      });
      expect(await response.json()).toEqual({ group: "gold", emotion: "excited", source: "model" });
    }, {
      moodClassifier: {
        classify: async () => ({ group: "gold", emotion: "excited", source: "model" }),
      },
    });
  });

  it("rejects an empty feeling description", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/mood-entries/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      });
      expect(response.status).toBe(400);
    });
  });
});
