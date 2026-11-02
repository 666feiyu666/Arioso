import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AlbumTrackTask, MusicTask } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const NOW = "2026-10-04T00:00:00.000Z";
const ALBUM_ID = "album-task";
const MOODMIC_ID = "moodmic-task";
const MP3_FRAME = Buffer.concat([Buffer.from([0xff, 0xfb, 0xb0, 0x44]), Buffer.alloc(622)]);

function track(id: string, order: number, overrides: Partial<AlbumTrackTask> = {}): AlbumTrackTask {
  return {
    id, order, title: `Track ${order}`, targetDurationSeconds: 120, status: "completed",
    admission: "included", audioFile: `${id}.mp3`, durationSeconds: 95,
    createdAt: NOW, updatedAt: NOW, ...overrides,
  };
}

function albumTask(): MusicTask {
  return {
    id: ALBUM_ID, title: "Night Set", description: "Quiet instrumental jazz.",
    mode: "generate", vocalMode: "instrumental", corpusMode: "none",
    compositionMode: "album", workflowType: "04-album", status: "completed",
    composerModel: "test", lyriaModel: "lyria-3.5", createdAt: NOW, updatedAt: NOW,
    albumTracks: [track("track-a", 1), track("track-b", 2)],
    albumTrackOrder: ["track-a", "track-b"],
  };
}

function moodmicTask(): MusicTask {
  return {
    id: MOODMIC_ID, description: "Rainy night piano", mode: "generate",
    vocalMode: "instrumental", corpusMode: "none", compositionMode: "single",
    workflowType: "01-general", status: "completed",
    composerModel: "test", lyriaModel: "lyria-3.5", createdAt: NOW, updatedAt: NOW,
    moodChatId: "chat-1", title: "Rain", audioFile: "rain.mp3",
  };
}

async function prepare(root: string, tasks: MusicTask[] = [albumTask(), moodmicTask()]): Promise<void> {
  for (const task of tasks) {
    const directory = path.join(root, "outputs", "tasks", task.workflowType, task.id);
    await mkdir(path.join(directory, "tracks"), { recursive: true });
    await writeFile(path.join(directory, "task.json"), JSON.stringify(task));
    if (task.audioFile) await writeFile(path.join(directory, task.audioFile), MP3_FRAME);
    for (const candidate of task.albumTracks ?? []) {
      if (candidate.audioFile) await writeFile(path.join(directory, "tracks", candidate.audioFile), MP3_FRAME);
    }
  }
}

interface ResolvedJson {
  playlist: { id: string; name: string; items: Array<{ id: string; titleSnapshot: string; missing: boolean }> };
  items: Array<{ id: string; titleSnapshot: string; missing: boolean; audioUrl?: string; albumTitle?: string }>;
  playableCount: number;
  missingCount: number;
}

const json = (response: Response) => response.json() as Promise<ResolvedJson>;

describe("playlist API", () => {
  it("lists addable pieces from albums and MoodMic without generating anything", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const body = await fetch(`${baseUrl}/api/pieces`).then((response) => response.json()) as {
        pieces: Array<{ source: { kind: string }; title: string; origin: string; audioUrl: string }>;
      };
      expect(body.pieces.map((piece) => piece.origin)).toEqual(["moodmic", "album", "album"]);
      expect(body.pieces.map((piece) => piece.title)).toEqual(["Rain", "Track 1", "Track 2"]);
      expect(body.pieces.every((piece) => piece.audioUrl.startsWith("/api/tasks/"))).toBe(true);
    }, { prepare });
  });

  it("creates a playlist from existing pieces in one step", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST",
        body: JSON.stringify({
          name: "Late night",
          items: [
            { source: { kind: "album-track", taskId: ALBUM_ID, trackId: "track-b" } },
            { source: { kind: "task", taskId: MOODMIC_ID } },
          ],
        }),
      });
      expect(created.status).toBe(201);
      const playlist = await json(created);
      expect(playlist.playlist.name).toBe("Late night");
      expect(playlist.items.map((item) => item.missing)).toEqual([false, false]);
      expect(playlist.items[0]?.audioUrl).toBe(`/api/tasks/${ALBUM_ID}/album/tracks/track-b/audio`);
      expect(playlist.items[1]?.audioUrl).toBe(`/api/tasks/${MOODMIC_ID}/audio`);
      expect(playlist.playableCount).toBe(2);

      const listed = await fetch(`${baseUrl}/api/playlists`).then((response) => response.json()) as ResolvedJson[];
      expect(listed).toHaveLength(1);
      expect(listed[0]?.playlist.id).toBe(playlist.playlist.id);
    }, { prepare });
  });

  it("adds, reorders, removes, renames and deletes without touching tasks", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await json(await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", body: JSON.stringify({ name: "Draft" }),
      }));
      const playlistId = created.playlist.id;

      const added = await json(await fetch(`${baseUrl}/api/playlists/${playlistId}/items`, {
        method: "POST",
        body: JSON.stringify({ items: [
          { source: { kind: "task", taskId: MOODMIC_ID } },
          { source: { kind: "album-track", taskId: ALBUM_ID, trackId: "track-a" } },
        ] }),
      }));
      expect(added.items).toHaveLength(2);

      const [first, second] = added.items;
      const reordered = await json(await fetch(`${baseUrl}/api/playlists/${playlistId}/items`, {
        method: "PUT", body: JSON.stringify({ itemIds: [second!.id, first!.id] }),
      }));
      expect(reordered.items.map((item) => item.id)).toEqual([second!.id, first!.id]);

      const removed = await json(await fetch(`${baseUrl}/api/playlists/${playlistId}/items/${first!.id}`, {
        method: "DELETE",
      }));
      expect(removed.items).toHaveLength(1);

      const renamed = await json(await fetch(`${baseUrl}/api/playlists/${playlistId}`, {
        method: "PATCH", body: JSON.stringify({ name: "Late night" }),
      }));
      expect(renamed.playlist.name).toBe("Late night");

      // The tasks behind the entries are untouched by any of it.
      const tasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json()) as MusicTask[];
      expect(tasks.map((task) => task.id).sort()).toEqual([ALBUM_ID, MOODMIC_ID]);

      const deleted = await fetch(`${baseUrl}/api/playlists/${playlistId}`, { method: "DELETE" });
      expect(deleted.status).toBe(200);
      expect(await fetch(`${baseUrl}/api/playlists/${playlistId}`).then((response) => response.status)).toBe(404);
    }, { prepare });
  });

  it("keeps entries whose album has been removed and reports them as missing", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await json(await fetch(`${baseUrl}/api/playlists`, {
        method: "POST",
        body: JSON.stringify({ items: [
          { source: { kind: "album-track", taskId: "deleted-album", trackId: "gone" } },
          { source: { kind: "task", taskId: MOODMIC_ID } },
        ] }),
      }));
      expect(created.items[0]?.missing).toBe(true);
      expect(created.items[1]?.missing).toBe(false);
      expect(created.missingCount).toBe(1);
      expect(created.items[0]?.titleSnapshot).toBeTruthy();
    }, { prepare });
  });

  it("rejects an entry that does not name a piece", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", body: JSON.stringify({ items: [{ title: "Nothing" }] }),
      });
      expect(response.status).toBe(400);
    }, { prepare });
  });

  it("accepts an empty request and still creates a usable playlist", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await fetch(`${baseUrl}/api/playlists`, { method: "POST" });
      expect(created.status).toBe(201);
      const playlist = await json(created);
      expect(playlist.items).toEqual([]);
      expect(playlist.playlist.name.length).toBeGreaterThan(0);
    }, { prepare });
  });

  it("stores and serves a playlist cover", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await json(await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", body: JSON.stringify({ name: "Covered" }),
      }));
      const playlistId = created.playlist.id;
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
      const uploaded = await fetch(`${baseUrl}/api/playlists/${playlistId}/cover`, { method: "POST", body: png });
      expect(uploaded.status).toBe(200);
      const served = await fetch(`${baseUrl}/api/playlists/${playlistId}/cover`);
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toContain("image/png");
      const cleared = await fetch(`${baseUrl}/api/playlists/${playlistId}/cover`, { method: "DELETE" });
      expect(cleared.status).toBe(200);
      expect(await fetch(`${baseUrl}/api/playlists/${playlistId}/cover`).then((response) => response.status)).toBe(404);
    }, { prepare });
  });

  it("catches a playlist up with an album that finished while nothing was watching", async () => {
    // A playlist opened for an album before any candidate existed.
    const prepareWaitingPlaylist = async (root: string): Promise<void> => {
      await prepare(root);
      await mkdir(path.join(root, "outputs", "playlists"), { recursive: true });
      await writeFile(path.join(root, "outputs", "playlists", "waiting.json"), JSON.stringify({
        schemaVersion: "1.0", id: "waiting", name: "Waiting", items: [],
        fromAlbumTaskId: ALBUM_ID,
        createdAt: NOW, updatedAt: NOW,
      }));
    };
    await withWebServer(async ({ baseUrl }) => {
      const albums = await fetch(`${baseUrl}/api/albums`).then((response) => response.json()) as Array<{
        id: string; playlistIds: string[];
      }>;
      expect(albums.map((album) => album.id)).toEqual([ALBUM_ID]);
      expect(albums[0]?.playlistIds).toEqual(["waiting"]);

      const playlist = await json(await fetch(`${baseUrl}/api/playlists/waiting`));
      expect(playlist.items.map((item) => item.titleSnapshot)).toEqual(["Track 1", "Track 2"]);

      // Reading again must not duplicate what is already there.
      await fetch(`${baseUrl}/api/albums`);
      const again = await json(await fetch(`${baseUrl}/api/playlists/waiting`));
      expect(again.items).toHaveLength(2);
    }, { prepare: prepareWaitingPlaylist });
  });

  it("exports a playlist as one MP3 with per-track timestamps and skips missing entries", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await json(await fetch(`${baseUrl}/api/playlists`, {
        method: "POST",
        body: JSON.stringify({
          name: "Export me",
          items: [
            { source: { kind: "album-track", taskId: ALBUM_ID, trackId: "track-a" } },
            { source: { kind: "task", taskId: MOODMIC_ID } },
            { source: { kind: "task", taskId: "gone-task" } },
          ],
        }),
      }));
      const manifest = await fetch(`${baseUrl}/api/playlists/${created.playlist.id}/export`, { method: "POST" })
        .then((response) => response.json()) as {
          trackCount: number; chapters: Array<{ title: string; time: string }>;
          skipped: string[]; audioUrl: string; timestampsUrl: string; fileName: string;
        };
      expect(manifest.trackCount).toBe(2);
      expect(manifest.chapters.map((chapter) => chapter.title)).toEqual(["Track 1", "Rain"]);
      expect(manifest.chapters[0]?.time).toBe("00:00");
      expect(manifest.skipped).toHaveLength(1);
      expect(manifest.fileName.endsWith(".mp3")).toBe(true);

      const audio = await fetch(`${baseUrl}${manifest.audioUrl}`);
      expect(audio.status).toBe(200);
      expect(audio.headers.get("content-type")).toContain("audio/mpeg");

      const timestamps = await fetch(`${baseUrl}${manifest.timestampsUrl}`).then((response) => response.text());
      expect(timestamps).toContain("Track 1");
      expect(timestamps).toContain("Rain");
    }, { prepare });
  });

  it("reports the album and playlist objects separately in capabilities", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const capabilities = await fetch(`${baseUrl}/api/capabilities`).then((response) => response.json()) as Record<string, unknown>;
      expect(capabilities.apiVersion).toBe(12);
      expect(capabilities.albums).toBe(true);
      expect(capabilities.playlists).toBe(true);
      expect(capabilities.albumTrackOrder).toBe(true);
    }, { prepare });
  });
});
