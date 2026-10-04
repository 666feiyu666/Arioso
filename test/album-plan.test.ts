import { describe, expect, it } from "vitest";

import { AlbumPlanSchema, validateAlbumReview } from "../src/schema/album-plan.js";
import { buildAlbumLyriaPrompt, renderAlbumSharedDirections } from "../src/composer/album-prompt.js";
import { albumPlanFixture, albumReviewFixture, albumSpecFixture } from "./album-fixtures.js";

describe("album candidate plan and prompt rendering", () => {
  it("accepts author-selected instrument groups and varied 1–3 minute targets", () => {
    const plan = albumPlanFixture();
    expect(plan.schemaVersion).toBe("1.0");
    expect(plan.tracks).toHaveLength(14);
    expect(new Set(plan.tracks.map((track) => track.targetSeconds)).size).toBe(3);
    expect(plan.tracks.reduce((sum, track) => sum + track.targetSeconds, 0)).toBe(2070);
    expect(plan.tracks[0]?.instruments).not.toEqual(plan.tracks[1]?.instruments);
  });

  it("rejects duplicate numbering, a fixed length and an undersized batch", () => {
    const plan = albumPlanFixture();
    expect(() => AlbumPlanSchema.parse({ ...plan, tracks: plan.tracks.map((track) => ({ ...track, number: 1 })) })).toThrow("numbered consecutively");
    expect(() => AlbumPlanSchema.parse({ ...plan, tracks: plan.tracks.map((track) => ({ ...track, targetSeconds: 150 })) })).toThrow("different candidate durations");
    expect(() => AlbumPlanSchema.parse({ ...plan, tracks: plan.tracks.map((track) => ({ ...track, targetSeconds: 60 + track.number })) })).toThrow("30–40 minutes");
    expect(() => AlbumPlanSchema.parse({ ...plan, tracks: plan.tracks.slice(0, 11) })).toThrow();
  });

  it("renders common audible directions and concrete fields without legacy batch instructions", () => {
    const plan = albumPlanFixture();
    const prompt = buildAlbumLyriaPrompt(plan, 1, albumSpecFixture());
    expect(prompt).toContain("Instrumental only, no vocals");
    expect(prompt).toContain("approximately 120 seconds");
    expect(prompt).toContain("Spacious phrasing and gently ambiguous harmony");
    expect(prompt).toContain("piano: States a low motif");
    expect(prompt).not.toContain("Vary foreground instrument");
    expect(prompt).not.toContain(plan.albumMind);
    expect(prompt).not.toContain(plan.cohesionStrategy);
    expect(prompt).not.toContain("Do not copy this prose");
    expect(prompt).not.toContain("internal creative decisions");
    expect(renderAlbumSharedDirections(plan)).not.toContain("ensemble size");
  });

  it("allows variation and alternating responses inside one piece", () => {
    const prompt = buildAlbumLyriaPrompt(albumPlanFixture(), 1, albumSpecFixture());
    expect(prompt).toContain("Vary the piano motif in the middle");
    expect(prompt).toContain("Alternate bass and piano responses");
    const plan = albumPlanFixture();
    plan.sharedSoundContract = "Vary the motif gently during the development.";
    expect(renderAlbumSharedDirections(plan)).toBe(plan.sharedSoundContract);
  });

  it("rejects cross-track musical dependencies, vocals and the known invalid piano name", () => {
    const plan = albumPlanFixture();
    const spec = albumSpecFixture();
    expect(() => buildAlbumLyriaPrompt(plan, 1, { ...spec, production: "Match the previous track" })).toThrow("standalone");
    expect(() => buildAlbumLyriaPrompt(plan, 1, { ...spec, vocals: { ...spec.vocals, enabled: true } })).toThrow("instrumental");
    expect(() => buildAlbumLyriaPrompt(plan, 1, { ...spec, instrumentation: [{ name: "hollow-body piano", role: "Harmony", timbre: "Dark" }] })).toThrow("accurate instrument");
  });

  it("requires exactly one supported prompt judgment per candidate", () => {
    const plan = albumPlanFixture();
    const review = albumReviewFixture();
    expect(() => validateAlbumReview(plan, review)).not.toThrow();
    expect(() => validateAlbumReview(plan, { ...review, candidates: review.candidates.slice(1) })).toThrow("every candidate");
    const first = review.candidates[0]!;
    expect(() => validateAlbumReview(plan, { ...review, candidates: [{ ...first, revisionBrief: "Change piano" }, ...review.candidates.slice(1)] })).toThrow("revision briefs");
    expect(() => validateAlbumReview(plan, { ...review, candidates: [{ ...first, verdict: "needs-work", revisionBrief: "Let bass carry the motif" }, ...review.candidates.slice(1)] })).toThrow("verdicts disagree");
  });
});
