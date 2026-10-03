import type { Agent } from "@openai/agents";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@openai/agents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@openai/agents")>(),
  run: mocks.run,
}));
vi.mock("../src/composer/composer-skill.js", () => ({
  loadComposerSkill: async () => "Local music prompting guidance.",
}));

import { composeMusic } from "../src/composer/composer-agent.js";

const spec = {
  schemaVersion: "1.0",
  title: "Quiet Evening",
  intent: "A quiet evening in Jazz.",
  genres: ["jazz"],
  moods: ["quiet"],
  tempo: { bpm: null, feel: "relaxed" },
  tonality: { tonic: null, mode: null },
  meter: null,
  instrumentation: [],
  structure: [],
  vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
  production: "Natural dynamics.",
  avoid: ["vocals"],
  assumptions: [],
  lyriaPrompt: "Quiet Jazz, instrumental only, no vocals.",
};

describe("Jazz corpus choice", () => {
  beforeEach(() => {
    mocks.run.mockReset();
    mocks.run.mockResolvedValue({ finalOutput: spec });
  });

  it("preserves Jazz intent without exposing a corpus search tool", async () => {
    const onRetrieval = vi.fn();
    await composeMusic("a quiet evening", {
      genre: "jazz", corpusMode: "none", onJazzRetrieval: onRetrieval,
    });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    expect(agent.instructions).toContain("Treat the request as a Jazz composition brief");
    expect(agent.instructions).toContain("Compose only from the request and the model's musical knowledge");
    expect(agent.tools).toEqual([]);
    expect(onRetrieval).not.toHaveBeenCalled();
  });

  it("retains Jazz intent and the retrieval tool when corpus is enabled", async () => {
    await composeMusic("a quiet evening", { corpusMode: "jazz" });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    expect(agent.instructions).toContain("Treat the request as a Jazz composition brief");
    expect(agent.tools).toEqual([expect.objectContaining({ name: "search_jazz_corpus" })]);
  });
});
