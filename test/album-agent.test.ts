import type { Agent } from "@openai/agents";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), compose: vi.fn(), skill: vi.fn() }));
vi.mock("../src/composer/agent-runner.js", () => ({ runComposerAgent: mocks.run }));
vi.mock("../src/composer/composer-agent.js", () => ({ composeMusic: mocks.compose }));
vi.mock("../src/composer/composer-skill.js", () => ({ loadComposerSkill: mocks.skill }));

import { composeAlbumTrack, planAlbum, reviewAlbumCandidates, reviseAlbumTrack } from "../src/composer/album-agent.js";
import { albumPlanFixture, albumReviewFixture, albumSpecFixture } from "./album-fixtures.js";

describe("album composition agents", () => {
  beforeEach(() => {
    mocks.run.mockReset();
    mocks.compose.mockReset().mockResolvedValue(albumSpecFixture());
    mocks.skill.mockReset().mockResolvedValue("Album composition guidance");
  });

  it("plans through the existing runner and preserves the requested model and candidate count", async () => {
    mocks.run.mockResolvedValue(albumPlanFixture());
    const plan = await planAlbum("late night noir jazz for relaxation", { model: "configured-model", candidateCount: 14, targetTotalMinutes: 35 });
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    const input = JSON.parse(mocks.run.mock.calls[0]?.[1] as string) as { candidateCount: number; targetTotalMinutes: number };
    expect(agent.model).toBe("configured-model");
    expect(agent.instructions).toContain("not prescribed invariants");
    expect(agent.instructions).toContain("at least three different durations");
    expect(input).toMatchObject({ candidateCount: 14, targetTotalMinutes: 35 });
    expect(plan.tracks).toHaveLength(14);
    expect(mocks.skill).toHaveBeenCalledWith("album");
  });

  it("composes through the existing Composer with instrumental and no-corpus settings", async () => {
    const plan = albumPlanFixture();
    const spec = await composeAlbumTrack(plan, 1, { model: "configured-model", genre: "jazz" });
    const brief = mocks.compose.mock.calls[0]?.[0] as string;
    expect(brief).toContain(plan.albumMind);
    expect(brief).toContain(plan.cohesionStrategy);
    expect(brief).toContain("120 seconds");
    expect(mocks.compose.mock.calls[0]?.[1]).toMatchObject({ model: "configured-model", vocalMode: "instrumental", corpusMode: "none", genre: "jazz", lyriaModel: "lyria-3.5" });
    expect(spec.lyriaPrompt).toContain("piano: States a low motif");
    expect(spec.lyriaPrompt).not.toContain("Do not copy this prose");
  });

  it("reviews actual rendered prompts and requires concrete, accurate musical evidence", async () => {
    mocks.run.mockResolvedValue(albumReviewFixture());
    const plan = albumPlanFixture();
    await reviewAlbumCandidates(plan, plan.tracks.map(() => albumSpecFixture()));
    const agent = mocks.run.mock.calls[0]?.[0] as Agent;
    const input = JSON.parse(mocks.run.mock.calls[0]?.[1] as string) as { candidates: Array<{ renderedLyriaPrompt: string }> };
    expect(agent.instructions).toContain("baritone saxophone, are reed woodwinds");
    expect(agent.instructions).toContain("never decisions to admit");
    expect(input.candidates).toHaveLength(14);
    expect(input.candidates[0]?.renderedLyriaPrompt).toContain("approximately 120 seconds");
    expect(input.candidates[0]?.renderedLyriaPrompt).not.toContain("Do not copy this prose");
  });

  it("selectively revises one candidate using the original and the complete prompt batch", async () => {
    const plan = albumPlanFixture();
    const original = albumSpecFixture();
    await reviseAlbumTrack(plan, 2, original, "Let the bass carry the motif", plan.tracks.map(() => original));
    const brief = mocks.compose.mock.calls[0]?.[0] as string;
    expect(mocks.compose).toHaveBeenCalledTimes(1);
    expect(brief).toContain("One selective revision pass");
    expect(brief).toContain("Let the bass carry the motif");
    expect(brief).toContain("Original MusicSpec");
    expect(brief).toContain("Complete candidate prompt batch");
    expect(brief).toContain('"number":14');
  });

  it("rejects unsupported requests and incomplete reviews before unrelated work", async () => {
    await expect(planAlbum("noir", { candidateCount: 11 })).rejects.toThrow("12–15");
    await expect(planAlbum("noir", { vocalMode: "vocals" })).rejects.toThrow("instrumental");
    await expect(reviewAlbumCandidates(albumPlanFixture(), [albumSpecFixture()])).rejects.toThrow("every candidate");
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.compose).not.toHaveBeenCalled();
  });
});
