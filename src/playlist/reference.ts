import type { MusicSpec } from "../schema/music-spec.js";

/**
 * A MoodMic creation the user chose to reuse as a reference. The Playlist
 * feature plans a whole album from these: the conversation's creative intent
 * plus the structured MusicSpec of the music it produced.
 */
export interface PlaylistReference {
  /** The MoodMic conversation this reference came from. */
  chatId: string;
  /** The MoodMic task whose music and spec back this reference. */
  taskId?: string;
  title: string;
  /** The conversation's agreed creative intent (its final prompt). */
  prompt: string;
  musicSpec?: MusicSpec;
}

export const MAX_PLAYLIST_REFERENCES = 8;

export function isPlaylistReference(value: unknown): value is PlaylistReference {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.chatId === "string"
    && typeof candidate.title === "string"
    && typeof candidate.prompt === "string"
    && (candidate.taskId === undefined || typeof candidate.taskId === "string");
}
