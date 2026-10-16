import { z } from "zod";

/**
 * The Playlist feature pauses for confirmation before spending money on
 * generation. These types are what the user confirms: how the album author
 * read each reused MoodMic creation and the user's own theme.
 */

/** How the album author read one reused MoodMic creation. */
export const PlaylistReferenceReadingSchema = z.object({
  title: z.string().min(1).describe("The reference's title, echoed exactly."),
  understood: z.string().min(1).describe("What this reference's music and stated intent actually are."),
  usedFor: z.string().min(1).describe("The concrete way this reference shapes the playlist."),
});

/** The album author's reading of the request, shown before any audio is generated. */
export const PlaylistBriefingSchema = z.object({
  intentReading: z.string().min(1).describe("How the playlist theme and its purpose were understood."),
  referenceReadings: z.array(PlaylistReferenceReadingSchema),
});

export type PlaylistReferenceReading = z.infer<typeof PlaylistReferenceReadingSchema>;
export type PlaylistBriefing = z.infer<typeof PlaylistBriefingSchema>;

/** One turn of the confirmation conversation between the user and the album author. */
export interface PlaylistDiscussionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function isPlaylistDiscussionMessage(value: unknown): value is PlaylistDiscussionMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && (candidate.role === "user" || candidate.role === "assistant")
    && typeof candidate.content === "string"
    && typeof candidate.createdAt === "string";
}

export const MAX_PLAYLIST_DISCUSSION_MESSAGES = 40;
export const MAX_PLAYLIST_FEEDBACK_LENGTH = 2_000;
