import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PlaylistStore } from "../src/playlist/playlist-store.js";
import {
  collectPlayablePieces,
  itemInputForAlbumTrack,
  playlistItemAudioPath,
  resolvePlaylist,
} from "../src/web/playlist-pieces.js";
import type { AlbumTrackTask, MusicTask } from "../src/web/task-store.js";

let root: string;
let store: PlaylistStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "arioso-playlist-test-"));
  store = new PlaylistStore(path.join(root, "playlists"));
  await store.initialize();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function track(overrides: Partial<AlbumTrackTask> & { id: string; order: number }): AlbumTrackTask {
  return {
    title: `Track ${overrides.order}`,
    status: "completed",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    targetDurationSeconds: 90,
    admission: "included",
    audioFile: `${overrides.order}.mp3`,
    durationSeconds: 90,
    ...overrides,
  };
}

function albumTask(overrides: Partial<MusicTask> = {}): MusicTask {
  return {
    id: "album-task",
    description: "A night album",
    mode: "generate",
    vocalMode: "instrumental",
    corpusMode: "none",
    compositionMode: "album",
    workflowType: "04-album",
    status: "completed",
    composerModel: "test",
    lyriaModel: "test",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    title: "Night Set",
    albumTracks: [track({ id: "track-a", order: 1 }), track({ id: "track-b", order: 2 })],
    ...overrides,
  };
}

function lookup(tasks: MusicTask[]) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return {
    get: (id: string) => byId.get(id),
    audioPath: (task: MusicTask) => task.audioFile
      ? path.join(root, "tasks", task.id, task.audioFile) : undefined,
    albumTrackAudioPath: (task: MusicTask, candidate: AlbumTrackTask) => candidate.audioFile
      ? path.join(root, "tasks", task.id, "tracks", candidate.audioFile) : undefined,
  };
}

describe("PlaylistStore", () => {
  it("creates an empty playlist with a fallback name and persists it", async () => {
    const playlist = await store.create({});
    expect(playlist.items).toEqual([]);
    expect(playlist.name.length).toBeGreaterThan(0);

    const reloaded = new PlaylistStore(path.join(root, "playlists"));
    await reloaded.initialize();
    expect(reloaded.get(playlist.id)?.name).toBe(playlist.name);
  });

  it("adds pieces without duplicating the same source", async () => {
    const playlist = await store.create({ name: "Late night" });
    const input = { source: { kind: "album-track" as const, taskId: "album-task", trackId: "track-a" }, titleSnapshot: "Track 1" };
    await store.addItems(playlist.id, [input]);
    const updated = await store.addItems(playlist.id, [input, {
      source: { kind: "task", taskId: "moodmic-task" }, titleSnapshot: "Rain",
    }]);
    expect(updated.items.map((item) => item.titleSnapshot)).toEqual(["Track 1", "Rain"]);
  });

  it("requires the new order to name every entry exactly once", async () => {
    const playlist = await store.create({ name: "Ordered", items: [
      { source: { kind: "task", taskId: "one" }, titleSnapshot: "One" },
      { source: { kind: "task", taskId: "two" }, titleSnapshot: "Two" },
    ] });
    const [first, second] = playlist.items;
    await expect(store.setItemOrder(playlist.id, [first!.id])).rejects.toThrow(/exactly once/u);
    const reordered = await store.setItemOrder(playlist.id, [second!.id, first!.id]);
    expect(reordered.items.map((item) => item.titleSnapshot)).toEqual(["Two", "One"]);
  });

  it("appends a finished album track once, even when replayed", async () => {
    await store.create({ name: "From album", fromAlbumTaskId: "album-task" });
    await store.appendAlbumTrack("album-task", { id: "track-a", title: "Track 1", durationSeconds: 90 });
    const again = await store.appendAlbumTrack("album-task", { id: "track-a", title: "Track 1", durationSeconds: 90 });
    expect(again[0]?.items).toHaveLength(1);
    const other = await store.appendAlbumTrack("other-album", { id: "track-z", title: "Elsewhere" });
    expect(other).toEqual([]);
  });

  it("keeps entries when their source disappears and reports them as missing", async () => {
    const playlist = await store.create({ name: "Survivor", items: [
      { source: { kind: "album-track", taskId: "album-task", trackId: "track-a" }, titleSnapshot: "Track 1" },
      { source: { kind: "task", taskId: "gone-task" }, titleSnapshot: "Vanished" },
    ] });
    const resolved = resolvePlaylist(playlist, lookup([albumTask()]));
    expect(resolved.items.map((item) => item.missing)).toEqual([false, true]);
    expect(resolved.missingCount).toBe(1);
    expect(resolved.playableCount).toBe(1);
    expect(resolved.items[0]?.audioUrl).toBe("/api/tasks/album-task/album/tracks/track-a/audio");
    expect(resolved.items[1]?.missingReason).toBeTruthy();
    // The record itself is untouched: a playlist outlives its sources.
    expect(store.get(playlist.id)?.items).toHaveLength(2);
  });

  it("reports a track of a deleted album as missing too", async () => {
    const playlist = await store.create({ name: "Orphan", items: [
      { source: { kind: "album-track", taskId: "album-task", trackId: "track-b" }, titleSnapshot: "Track 2" },
    ] });
    const resolved = resolvePlaylist(playlist, lookup([albumTask({ albumTracks: [track({ id: "track-a", order: 1 })] })]));
    expect(resolved.items[0]?.missing).toBe(true);
  });

  it("deletes the record and its directory", async () => {
    const playlist = await store.create({ name: "Temporary" });
    await mkdir(store.playlistDirectory(playlist.id), { recursive: true });
    await writeFile(path.join(store.playlistDirectory(playlist.id), "cover.png"), "x");
    expect(await store.remove(playlist.id)).toBe(true);
    expect(store.get(playlist.id)).toBeUndefined();
    await expect(readFile(path.join(root, "playlists", `${playlist.id}.json`), "utf8")).rejects.toThrow();
  });

  it("ignores a malformed record on disk instead of failing to start", async () => {
    await writeFile(path.join(root, "playlists", "broken.json"), "{ not json");
    const reloaded = new PlaylistStore(path.join(root, "playlists"));
    await reloaded.initialize();
    expect(reloaded.list()).toEqual([]);
  });
});

describe("playlist pieces", () => {
  const moodmic = (overrides: Partial<MusicTask> = {}): MusicTask => ({
    id: "moodmic-task",
    description: "Rainy night piano",
    mode: "generate",
    vocalMode: "instrumental",
    corpusMode: "none",
    compositionMode: "single",
    workflowType: "01-general",
    status: "completed",
    composerModel: "test",
    lyriaModel: "test",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-03T00:00:00.000Z",
    moodChatId: "chat-1",
    audioFile: "moodmic.mp3",
    ...overrides,
  });

  it("offers MoodMic pieces and album tracks as addable pieces", () => {
    const pieces = collectPlayablePieces([albumTask(), moodmic()]);
    expect(pieces.map((piece) => piece.origin)).toEqual(["moodmic", "album", "album"]);
    expect(pieces.every((piece) => piece.audioUrl.startsWith("/api/tasks/"))).toBe(true);
  });

  it("skips unfinished and excluded pieces", () => {
    const pieces = collectPlayablePieces([
      albumTask({ albumTracks: [track({ id: "track-a", order: 1, admission: "excluded" })] }),
      moodmic({ status: "failed" }),
    ]);
    expect(pieces).toEqual([]);
  });

  it("resolves an entry's audio file for export", () => {
    const tasks = lookup([albumTask()]);
    const item = itemInputForAlbumTrack(albumTask(), track({ id: "track-a", order: 1 }));
    expect(item).toBeDefined();
    const path_ = playlistItemAudioPath({
      id: "item", source: item!.source, titleSnapshot: "Track 1", addedAt: "2025-01-01T00:00:00.000Z",
    }, tasks);
    expect(path_).toBe(path.join(root, "tasks", "album-task", "tracks", "1.mp3"));
  });
});
