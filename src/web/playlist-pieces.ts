import type {
  PlaylistItem,
  PlaylistItemInput,
  PlaylistItemSource,
  ResolvedPlaylist,
  ResolvedPlaylistItem,
} from "../playlist/playlist.js";
import type { AlbumTrackTask, MusicTask, TaskStore } from "./task-store.js";

/** What resolution needs from the task store; keeps this module easy to test. */
export type PieceLookup = Pick<TaskStore, "get" | "audioPath" | "albumTrackAudioPath">;

/** One piece the listener can add to a playlist. */
export interface PlayablePiece {
  source: PlaylistItemSource;
  title: string;
  durationSeconds?: number;
  audioUrl: string;
  /** Where the piece came from, for grouping in the picker. */
  origin: "moodmic" | "album" | "single";
  albumTitle?: string;
  albumTaskId?: string;
  createdAt: string;
}

const MISSING_TASK = "这首曲子已经不存在了。";
const MISSING_TRACK = "这首曲子所在的专辑已被删除或重新生成。";
const MISSING_AUDIO = "这首曲子的音频文件已不可用。";

/** The title a piece is best known by. */
export function pieceTitle(task: MusicTask): string {
  return task.title?.trim() || task.musicSpec?.title?.trim() || task.description.trim() || task.id;
}

export function albumTitle(task: MusicTask): string | undefined {
  return task.albumPlan?.albumTitle?.trim() || task.title?.trim() || undefined;
}

/**
 * Resolves one playlist entry against the tasks that exist right now. A piece
 * that no longer resolves stays in the list, reported as missing: the playlist
 * outlives the albums and conversations it drew from.
 */
export function resolvePlaylistItem(item: PlaylistItem, tasks: PieceLookup): ResolvedPlaylistItem {
  const source = item.source;
  const task = tasks.get(source.taskId);
  if (!task) return { ...item, missing: true, missingReason: MISSING_TASK };

  if (source.kind === "task") {
    if (!task.audioFile) return { ...item, missing: true, missingReason: MISSING_AUDIO };
    return {
      ...item,
      missing: false,
      audioUrl: `/api/tasks/${encodeURIComponent(task.id)}/audio`,
      titleSnapshot: item.titleSnapshot || pieceTitle(task),
    };
  }

  const track = task.albumTracks?.find((candidate) => candidate.id === source.trackId);
  if (!track) return { ...item, missing: true, missingReason: MISSING_TRACK };
  if (!track.audioFile || !tasks.albumTrackAudioPath(task, track)) {
    return { ...item, missing: true, missingReason: MISSING_AUDIO };
  }
  const album = albumTitle(task);
  return {
    ...item,
    missing: false,
    audioUrl: `/api/tasks/${encodeURIComponent(task.id)}/album/tracks/${encodeURIComponent(track.id)}/audio`,
    ...(album ? { albumTitle: album } : {}),
  };
}

export function resolvePlaylist(
  playlist: { items: PlaylistItem[] },
  tasks: PieceLookup,
): ResolvedPlaylist {
  const items = playlist.items.map((item) => resolvePlaylistItem(item, tasks));
  const playable = items.filter((item) => !item.missing);
  return {
    playlist: playlist as ResolvedPlaylist["playlist"],
    items,
    playableSeconds: playable.reduce((total, item) => total + (item.durationSeconds ?? 0), 0),
    playableCount: playable.length,
    missingCount: items.length - playable.length,
  };
}

/** The audio file a playlist entry exports from, or undefined when missing. */
export function playlistItemAudioPath(item: PlaylistItem, tasks: PieceLookup): string | undefined {
  const source = item.source;
  const task = tasks.get(source.taskId);
  if (!task) return undefined;
  if (source.kind === "task") return tasks.audioPath(task);
  const track = task.albumTracks?.find((candidate) => candidate.id === source.trackId);
  if (!track) return undefined;
  return tasks.albumTrackAudioPath(task, track);
}

/** A playlist entry describing one finished piece, for "add to playlist". */
export function itemInputForTask(task: MusicTask): PlaylistItemInput | undefined {
  if (!task.audioFile) return undefined;
  return {
    source: { kind: "task", taskId: task.id },
    titleSnapshot: pieceTitle(task),
  };
}

/**
 * The title and length a piece already has, so an entry added by source alone
 * still reads properly and keeps its length if the piece later disappears.
 */
export function describeSource(
  source: PlaylistItemSource,
  tasks: PieceLookup,
): { title: string; durationSeconds?: number } {
  const task = tasks.get(source.taskId);
  if (!task) return { title: "Untitled" };
  if (source.kind === "task") return { title: pieceTitle(task) };
  const track = task.albumTracks?.find((candidate) => candidate.id === source.trackId);
  if (!track) return { title: "Untitled" };
  return {
    title: track.title,
    ...(track.durationSeconds === undefined ? {} : { durationSeconds: track.durationSeconds }),
  };
}

export function itemInputForAlbumTrack(task: MusicTask, track: AlbumTrackTask): PlaylistItemInput | undefined {
  if (!track.audioFile) return undefined;
  return {
    source: { kind: "album-track", taskId: task.id, trackId: track.id },
    titleSnapshot: track.title,
    ...(track.durationSeconds !== undefined ? { durationSeconds: track.durationSeconds } : {}),
  };
}

/**
 * Everything the listener may add to a playlist: MoodMic creations, standalone
 * pieces, and the finished tracks of every album, newest first.
 */
export function collectPlayablePieces(tasks: readonly MusicTask[]): PlayablePiece[] {
  const pieces: PlayablePiece[] = [];
  for (const task of tasks) {
    if (task.compositionMode === "album") {
      const album = albumTitle(task);
      const tracks = [...(task.albumTracks ?? [])]
        .filter((track) => track.audioFile && track.admission !== "excluded")
        .sort((left, right) => left.order - right.order);
      for (const track of tracks) {
        pieces.push({
          source: { kind: "album-track", taskId: task.id, trackId: track.id },
          title: track.title,
          ...(track.durationSeconds !== undefined ? { durationSeconds: track.durationSeconds } : {}),
          audioUrl: `/api/tasks/${encodeURIComponent(task.id)}/album/tracks/${encodeURIComponent(track.id)}/audio`,
          origin: "album",
          ...(album ? { albumTitle: album } : {}),
          albumTaskId: task.id,
          createdAt: track.updatedAt,
        });
      }
      continue;
    }
    if (!task.audioFile || task.status !== "completed") continue;
    pieces.push({
      source: { kind: "task", taskId: task.id },
      title: pieceTitle(task),
      audioUrl: `/api/tasks/${encodeURIComponent(task.id)}/audio`,
      origin: task.moodChatId ? "moodmic" : "single",
      createdAt: task.updatedAt,
    });
  }
  return pieces.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
