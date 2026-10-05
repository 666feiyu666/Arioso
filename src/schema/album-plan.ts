import { z } from "zod";

export const ALBUM_MIN_CANDIDATES = 12;
export const ALBUM_MAX_CANDIDATES = 28;
export const ALBUM_MIN_TOTAL_MINUTES = 30;
export const ALBUM_MAX_TOTAL_MINUTES = 70;
export const ALBUM_TARGET_TOLERANCE_MINUTES = 5;

export function isAlbumTargetFeasible(candidateCount: number, targetTotalMinutes: number): boolean {
  const minimumDurationMinutes = candidateCount;
  const maximumDurationMinutes = candidateCount * 3;
  return targetTotalMinutes >= minimumDurationMinutes - ALBUM_TARGET_TOLERANCE_MINUTES
    && targetTotalMinutes <= maximumDurationMinutes + ALBUM_TARGET_TOLERANCE_MINUTES;
}

export const AlbumTrackOutlineSchema = z.object({
  number: z.number().int().min(1).max(ALBUM_MAX_CANDIDATES),
  title: z.string().min(1),
  musicalRole: z.string().min(1).describe("What the musicians do and how this candidate serves the album idea."),
  instruments: z.array(z.string().min(1)).min(1),
  groove: z.string().min(1),
  harmony: z.string().min(1),
  development: z.string().min(1).describe("An independent beginning, development and ending."),
  targetSeconds: z.number().int().min(60).max(180),
});

export const AlbumPlanDraftSchema = z.object({
  albumTitle: z.string().min(1),
  albumMind: z.string().min(1).describe("The author's concise creative idea for the complete listening experience."),
  cohesionStrategy: z.string().min(1).describe("Author-selected consistency, variation and grouping, with their musical purpose."),
  sharedSoundContract: z.string().min(1).describe("Only audible directions that apply to every candidate. Put distribution and variation rules in cohesionStrategy."),
  tracks: z.array(AlbumTrackOutlineSchema).min(ALBUM_MIN_CANDIDATES).max(ALBUM_MAX_CANDIDATES),
});

export const AlbumPlanSchema = AlbumPlanDraftSchema.extend({
  schemaVersion: z.literal("1.0").default("1.0"),
}).superRefine((plan, context) => {
  const numbers = plan.tracks.map((track) => track.number).sort((a, b) => a - b);
  if (numbers.some((number, index) => number !== index + 1)) {
    context.addIssue({ code: "custom", path: ["tracks"], message: "Album candidates must be numbered consecutively from one." });
  }
  const total = plan.tracks.reduce((sum, track) => sum + track.targetSeconds, 0);
  if (total < ALBUM_MIN_TOTAL_MINUTES * 60 || total > ALBUM_MAX_TOTAL_MINUTES * 60) {
    context.addIssue({ code: "custom", path: ["tracks"], message: "Album duration targets must total approximately 30–70 minutes." });
  }
  if (new Set(plan.tracks.map((track) => track.targetSeconds)).size < 3) {
    context.addIssue({ code: "custom", path: ["tracks"], message: "Use at least three different candidate durations rather than a fixed track length." });
  }
});

export const AlbumReviewSchema = z.object({
  verdict: z.enum(["ready", "needs-work"]),
  albumFindings: z.array(z.string()),
  similarities: z.array(z.object({
    first: z.number().int().min(1).max(ALBUM_MAX_CANDIDATES),
    second: z.number().int().min(1).max(ALBUM_MAX_CANDIDATES),
    evidence: z.string().min(1),
    judgment: z.string().min(1),
  })),
  candidates: z.array(z.object({
    number: z.number().int().min(1).max(ALBUM_MAX_CANDIDATES),
    verdict: z.enum(["ready", "needs-work"]),
    evidence: z.array(z.string().min(1)).min(1),
    revisionBrief: z.string().nullable(),
  })).min(ALBUM_MIN_CANDIDATES).max(ALBUM_MAX_CANDIDATES),
});

export type AlbumTrackOutline = z.infer<typeof AlbumTrackOutlineSchema>;
export type AlbumPlan = z.infer<typeof AlbumPlanSchema>;
export type AlbumReview = z.infer<typeof AlbumReviewSchema>;

export function validateAlbumReview(plan: AlbumPlan, review: AlbumReview): void {
  const numbers = review.candidates.map((candidate) => candidate.number).sort((a, b) => a - b);
  if (numbers.length !== plan.tracks.length || numbers.some((number, index) => number !== index + 1)) {
    throw new Error("The album review must cover every candidate exactly once.");
  }
  if (review.candidates.some((candidate) => candidate.verdict === "ready"
    ? candidate.revisionBrief !== null : !candidate.revisionBrief?.trim())) {
    throw new Error("Album review revision briefs must agree with candidate verdicts.");
  }
  const expectedVerdict = review.candidates.some((candidate) => candidate.verdict === "needs-work") ? "needs-work" : "ready";
  if (review.verdict !== expectedVerdict) throw new Error("Album and candidate review verdicts disagree.");
  if (review.similarities.some((item) => item.first === item.second || item.first > plan.tracks.length || item.second > plan.tracks.length)) {
    throw new Error("Album comparisons must refer to two different candidates in this plan.");
  }
}
