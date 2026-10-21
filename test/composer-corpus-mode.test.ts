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
  intent: "A quiet evening.",
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
  lyriaPrompt: "Quiet music, instrumental only, no vocals.",
};

describe("music corpus choice", () => {
  beforeEach(() => {
    mocks.run.mockReset();
    mocks.run.mockResolvedValue({ finalOutput: spec });
  });

  it("keeps the no-corpus path free of retrieval tools", async () => {
    const onMusicRetrieval = vi.fn();
    await composeMusic("a quiet evening", {
      corpusMode: "none", onMusicRetrieval,
    });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    expect(agent.instructions).toContain("Compose only from the request and the model's musical knowledge");
    expect(agent.instructions).not.toContain("search_music_corpus");
    expect(agent.tools).toEqual([]);
    expect(onMusicRetrieval).not.toHaveBeenCalled();
  });

  it("exposes the bounded music corpus tool when retrieval is enabled", async () => {
    await composeMusic("a quiet evening", { corpusMode: "music" });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    expect(agent.instructions).toContain("search_music_corpus");
    expect(agent.instructions).toContain("jazz, blues, electronic, instrumental-rock, instrumental-hip-hop");
    expect(agent.tools).toEqual([expect.objectContaining({ name: "search_music_corpus" })]);
  });

  it("binds the music type when the interface selected one", async () => {
    await composeMusic("a quiet evening", { corpusMode: "music", musicType: "electronic" });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    expect(agent.instructions).toContain("bound the music type to electronic");
  });
});
