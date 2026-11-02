import { z } from "zod";

/**
 * A playlist is assembled, never generated. It sequences pieces that already
 * exist — MoodMic creations and album candidates — and holds no audio of its
 * own. Generation belongs to the album: a playlist created from an album keeps
 * referencing that album's tracks, so it survives the album being reordered,
 * excluded from, or deleted.
 */

export const PLAYLIST_NAME_MAX_LENGTH = 120;

/** Where one playlist entry's audio comes from. */
export const PlaylistItemSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("task"),
    taskId: z.string().min(1).describe("A finished piece: a MoodMic creation or a single-music task."),
  }),
  z.object({
    kind: z.literal("album-track"),
    taskId: z.string().min(1).describe("The album task that generated this track."),
    trackId: z.string().min(1).describe("The album candidate inside that task."),
  }),
]);

export const PlaylistItemSchema = z.object({
  id: z.string().min(1),
  source: PlaylistItemSourceSchema,
  /**
   * The title as it was when the entry was added. Kept so an entry whose piece
   * no longer resolves can still be shown and reported as missing.
   */
  titleSnapshot: z.string(),
  durationSeconds: z.number().nonnegative().optional(),
  addedAt: z.string().min(1),
});

export const PlaylistSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string().min(1),
  name: z.string().min(1).max(PLAYLIST_NAME_MAX_LENGTH),
  description: z.string().optional(),
  /** Cover image inside the playlist's own directory. */
  coverFile: z.string().optional(),
  coverUpdatedAt: z.string().optional(),
  /**
   * The album task this playlist was created from, when the listener started
   * it as an album. Display and append-only synchronisation only: it never
   * makes the playlist re-read or re-generate anything.
   */
  fromAlbumTaskId: z.string().optional(),
  items: z.array(PlaylistItemSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type PlaylistItemSource = z.infer<typeof PlaylistItemSourceSchema>;
export type PlaylistItem = z.infer<typeof PlaylistItemSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;

/** The source a caller may add; the entry id and timestamp are the store's. */
export interface PlaylistItemInput {
  source: PlaylistItemSource;
  titleSnapshot?: string;
  durationSeconds?: number;
}

/** One entry after its source was looked up, ready for the interface. */
export interface ResolvedPlaylistItem extends PlaylistItem {
  /** The piece could not be found: the album or task is gone, or audio is absent. */
  missing: boolean;
  /** Why it is missing, in the listener's words. */
  missingReason?: string;
  /** Byte-range playback URL, absent when the entry is missing. */
  audioUrl?: string;
  /** The album this track belongs to, when the entry came from one. */
  albumTitle?: string;
}

export interface ResolvedPlaylist {
  playlist: Playlist;
  items: ResolvedPlaylistItem[];
  /** Playable duration of the resolvable entries. */
  playableSeconds: number;
  playableCount: number;
  missingCount: number;
}

export function playlistItemTitle(item: PlaylistItemInput): string {
  return item.titleSnapshot?.trim() || "Untitled";
}

/** Two entries are the same piece when they point at the same source. */
export function playlistItemSourceKey(source: PlaylistItemSource): string {
  return source.kind === "task"
    ? `task:${source.taskId}`
    : `album-track:${source.taskId}:${source.trackId}`;
}

export function isPlaylistItemSource(value: unknown): value is PlaylistItemSource {
  return PlaylistItemSourceSchema.safeParse(value).success;
}
