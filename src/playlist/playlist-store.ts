import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
import { KeyedQueue } from "../utils/queues.js";
import { isSafeFileName, safeFileName } from "../utils/safe-name.js";
import { isRecord } from "../utils/validation.js";
import {
  PlaylistSchema,
  playlistItemSourceKey,
  playlistItemTitle,
  type Playlist,
  type PlaylistItem,
  type PlaylistItemInput,
  type PlaylistItemSource,
} from "./playlist.js";

const MAX_PLAYLIST_NAME_LENGTH = 120;

export interface CreatePlaylistInput {
  name?: string;
  description?: string;
  items?: PlaylistItemInput[];
  /** The album this playlist was created from, when the listener started one. */
  fromAlbumTaskId?: string;
}

/**
 * Playlists are small JSON records in their own directory. They never hold
 * audio: every entry names a piece an album or a MoodMic conversation already
 * produced, so removing a piece leaves a playlist intact with one entry
 * reported as missing. Nothing here generates or regenerates anything.
 */
export class PlaylistStore {
  readonly #directory: string;
  readonly #playlists = new Map<string, Playlist>();
  /** One mutation at a time per playlist: read, derive, persist, publish. */
  readonly #mutations = new KeyedQueue();

  constructor(directory: string) {
    this.#directory = path.resolve(directory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    for (const entry of await readdir(this.#directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const value: unknown = JSON.parse(await readFile(path.join(this.#directory, entry.name), "utf8"));
        const parsed = PlaylistSchema.safeParse(value);
        if (parsed.success) this.#playlists.set(parsed.data.id, parsed.data);
      } catch {
        // Keep a malformed record on disk without exposing it at runtime.
      }
    }
  }

  get(id: string): Playlist | undefined {
    return this.#playlists.get(id);
  }

  list(): Playlist[] {
    return [...this.#playlists.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt));
  }

  /** The playlists an album is the source of, newest first. */
  listFromAlbum(taskId: string): Playlist[] {
    return this.list().filter((playlist) => playlist.fromAlbumTaskId === taskId);
  }

  async create(input: CreatePlaylistInput): Promise<Playlist> {
    const now = new Date().toISOString();
    const items = this.#buildItems(input.items ?? [], now);
    const playlist: Playlist = {
      schemaVersion: "1.0",
      id: crypto.randomUUID(),
      name: cleanName(input.name) ?? defaultName(now),
      ...(cleanDescription(input.description) ? { description: cleanDescription(input.description) } : {}),
      ...(input.fromAlbumTaskId && isSafeFileName(input.fromAlbumTaskId)
        ? { fromAlbumTaskId: input.fromAlbumTaskId } : {}),
      items,
      createdAt: now,
      updatedAt: now,
    };
    await this.save(playlist);
    this.#playlists.set(playlist.id, playlist);
    return playlist;
  }

  async rename(id: string, name: string, description?: string | null): Promise<Playlist> {
    const cleaned = cleanName(name);
    if (!cleaned) throw new Error("A playlist name is required.");
    return this.#mutate(id, () => ({
      name: cleaned,
      ...(description === undefined
        ? {}
        : { description: cleanDescription(description) }),
    }));
  }

  /** Adds pieces, skipping ones the playlist already holds. */
  async addItems(id: string, inputs: PlaylistItemInput[]): Promise<Playlist> {
    return this.#mutate(id, (playlist) => {
      const existing = new Set(playlist.items.map((item) => playlistItemSourceKey(item.source)));
      const added = inputs
        .filter((input) => !existing.has(playlistItemSourceKey(input.source)))
        .map((input) => this.#buildItem(input, new Date().toISOString()));
      for (const item of added) existing.add(playlistItemSourceKey(item.source));
      return { items: [...playlist.items, ...added] };
    });
  }

  async removeItem(id: string, itemId: string): Promise<Playlist> {
    return this.#mutate(id, (playlist) => ({
      items: playlist.items.filter((item) => item.id !== itemId),
    }));
  }

  /** Replaces the order; the caller must name every entry exactly once. */
  async setItemOrder(id: string, itemIds: string[]): Promise<Playlist> {
    return this.#mutate(id, (playlist) => {
      const current = playlist.items.map((item) => item.id);
      if (itemIds.length !== current.length
        || new Set(itemIds).size !== itemIds.length
        || itemIds.some((itemId) => !current.includes(itemId))) {
        throw new Error("The new order must contain every playlist entry exactly once.");
      }
      const byId = new Map(playlist.items.map((item) => [item.id, item]));
      return { items: itemIds.map((itemId) => byId.get(itemId)!) };
    });
  }

  /**
   * Appends one finished album track. Repeated calls for the same track are
   * ignored, so a re-read of an album after a restart cannot duplicate entries.
   */
  async appendAlbumTrack(
    albumTaskId: string,
    track: { id: string; title: string; durationSeconds?: number },
  ): Promise<Playlist[]> {
    const targets = this.listFromAlbum(albumTaskId);
    const updated: Playlist[] = [];
    for (const playlist of targets) {
      const next = await this.#mutate(playlist.id, (current) => {
        const key = playlistItemSourceKey({ kind: "album-track", taskId: albumTaskId, trackId: track.id });
        if (current.items.some((item) => playlistItemSourceKey(item.source) === key)) return {};
        return {
          items: [...current.items, {
            id: crypto.randomUUID(),
            source: { kind: "album-track", taskId: albumTaskId, trackId: track.id },
            titleSnapshot: track.title,
            ...(track.durationSeconds !== undefined ? { durationSeconds: track.durationSeconds } : {}),
            addedAt: new Date().toISOString(),
          } satisfies PlaylistItem],
        };
      });
      updated.push(next);
    }
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.#mutations.run(id, async () => {
      if (!this.#playlists.has(id)) return false;
      // Remove the record from disk first: a failed delete keeps it retryable.
      await rm(this.playlistDirectory(id), { recursive: true, force: true });
      await rm(path.join(this.#directory, `${id}.json`), { force: true });
      this.#playlists.delete(id);
      return true;
    });
  }

  playlistDirectory(id: string): string {
    return path.join(this.#directory, id);
  }

  coverPath(playlist: Playlist): string {
    return path.join(this.playlistDirectory(playlist.id), playlist.coverFile
      ?? safeFileName(playlist.name, playlist.id, "png"));
  }

  async writeCover(id: string, image: Buffer, extension: string): Promise<Playlist> {
    const playlist = this.#playlists.get(id);
    if (!playlist) throw new Error("Playlist not found.");
    const directory = this.playlistDirectory(id);
    await mkdir(directory, { recursive: true });
    const fileName = safeFileName(playlist.name, playlist.id, extension);
    const previous = this.coverPath(playlist);
    await writeFile(path.join(directory, fileName), image);
    if (path.basename(previous) !== fileName) await rm(previous, { force: true });
    return this.#mutate(id, () => ({
      coverFile: fileName,
      coverUpdatedAt: new Date().toISOString(),
    }));
  }

  async removeCover(id: string): Promise<Playlist> {
    const playlist = this.#playlists.get(id);
    if (!playlist) throw new Error("Playlist not found.");
    await rm(this.coverPath(playlist), { force: true });
    return this.#mutate(id, () => ({ coverFile: undefined, coverUpdatedAt: undefined }));
  }

  #buildItems(inputs: PlaylistItemInput[], addedAt: string): PlaylistItem[] {
    const items: PlaylistItem[] = [];
    const seen = new Set<string>();
    for (const input of inputs) {
      const key = playlistItemSourceKey(input.source);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(this.#buildItem(input, addedAt));
    }
    return items;
  }

  #buildItem(input: PlaylistItemInput, addedAt: string): PlaylistItem {
    return {
      id: crypto.randomUUID(),
      source: input.source,
      titleSnapshot: playlistItemTitle(input),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
      addedAt,
    };
  }

  #mutate(id: string, change: (playlist: Playlist) => Partial<Playlist>): Promise<Playlist> {
    return this.#mutations.run(id, async () => {
      const playlist = this.#playlists.get(id);
      if (!playlist) throw new Error("Playlist not found.");
      const updated: Playlist = {
        ...playlist,
        ...change(playlist),
        id: playlist.id,
        schemaVersion: "1.0",
        updatedAt: new Date().toISOString(),
      };
      await this.save(updated);
      this.#playlists.set(id, updated);
      return updated;
    });
  }

  private save(playlist: Playlist): Promise<void> {
    return writeTextFileAtomic(
      path.join(this.#directory, `${playlist.id}.json`),
      `${JSON.stringify(playlist, null, 2)}\n`,
    );
  }
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = Array.from(value.trim()).slice(0, MAX_PLAYLIST_NAME_LENGTH).join("").trim();
  return trimmed || undefined;
}

function cleanDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** A new playlist without a name is named after the moment it was made. */
function defaultName(now: string): string {
  const created = new Date(now);
  const date = Number.isNaN(created.getTime()) ? "" : ` ${created.toISOString().slice(0, 10)}`;
  return `Playlist${date}`;
}

/** Re-exported so callers validate a source without importing the schema file. */
export function isPlaylistItemSourceRecord(value: unknown): value is PlaylistItemSource {
  return isRecord(value);
}
