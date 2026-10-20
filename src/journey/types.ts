import { isRecord } from "../utils/validation.js";

/**
 * A MusicJourney is the small, persistent record that links the artifacts of a
 * single continuous flow — one MoodMic conversation, its kept song, and the
 * album planned from that song — without duplicating any of their content.
 */

export const JOURNEY_PHASES = [
  "mood",
  "song-running",
  "song-review",
  "song-ready",
  "album-planning",
  "album-review",
  "album-running",
  "album-curation",
  "completed",
  "failed",
] as const;

export type JourneyPhase = (typeof JOURNEY_PHASES)[number];

export interface MusicJourney {
  id: string;
  moodChatId: string;
  moodEntryId?: string;
  songTaskId?: string;
  albumTaskId?: string;
  phase: JourneyPhase;
  /** The plan revision the user confirmed; a later revision invalidates it. */
  approvedPlanRevision?: number;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Phases in which work is in flight, so a restart must not silently resume it. */
export const ACTIVE_JOURNEY_PHASES: readonly JourneyPhase[] = [
  "song-running",
  "album-planning",
  "album-running",
];

export function isJourneyPhase(value: unknown): value is JourneyPhase {
  return JOURNEY_PHASES.includes(value as JourneyPhase);
}

export function isMusicJourney(value: unknown): value is MusicJourney {
  return isRecord(value)
    && typeof value.id === "string" && /^[a-f0-9-]{36}$/u.test(value.id)
    && typeof value.moodChatId === "string" && value.moodChatId.length > 0
    && isJourneyPhase(value.phase)
    && (value.moodEntryId === undefined || typeof value.moodEntryId === "string")
    && (value.songTaskId === undefined || typeof value.songTaskId === "string")
    && (value.albumTaskId === undefined || typeof value.albumTaskId === "string")
    && (value.approvedPlanRevision === undefined
      || (Number.isInteger(value.approvedPlanRevision) && Number(value.approvedPlanRevision) > 0))
    && (value.error === undefined || typeof value.error === "string")
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}
