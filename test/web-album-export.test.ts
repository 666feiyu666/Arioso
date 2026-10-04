import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AlbumTrackTask, MusicTask } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const FRAME_LENGTH = 626;
const FRAME_DURATION = 1_152 / 44_100;
const MP3_HEADER = Buffer.from([0xff, 0xfb, 0xb0, 0x44]);
const EMPTY_ID3V2_TAG = Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]);
const TASK_ID = "album-export-task";

function audioFrame(trackNumber: number, frameNumber: number): Buffer {
  const frame = Buffer.alloc(FRAME_LENGTH);
  MP3_HEADER.copy(frame);
  frame.write(`track-${trackNumber}-frame-${frameNumber}`, 100, "ascii");
  return frame;
}

function audioFrames(trackNumber: number, frameCount = 2): Buffer {
  return Buffer.concat(Array.from({ length: frameCount }, (_, index) => audioFrame(trackNumber, index + 1)));
}

function taggedMp3(trackNumber: number, frameCount = 2): Buffer {
  const metadataFrame = Buffer.alloc(FRAME_LENGTH);
  MP3_HEADER.copy(metadataFrame);
  metadataFrame.write("Xing", 36, "ascii");
  const id3v1 = Buffer.alloc(128);
  id3v1.write("TAG", 0, "ascii");
  return Buffer.concat([EMPTY_ID3V2_TAG, metadataFrame, audioFrames(trackNumber, frameCount), id3v1]);
}

function album(overrides: Partial<MusicTask> = {}): MusicTask {
  const now = "2026-10-04T00:00:00.000Z";
  return {
    id: TASK_ID, title: "Late Night Noir", description: "Quiet instrumental jazz.",
    mode: "generate", vocalMode: "instrumental", corpusMode: "none",
    compositionMode: "album", workflowType: "04-album", status: "completed",
    composerModel: "test", lyriaModel: "lyria-3.5", createdAt: now, updatedAt: now,
    albumPlaylist: ["track-3", "track-1"],
    albumTracks: [1, 2, 3].map((number): AlbumTrackTask => ({
      id: `track-${number}`, order: number, title: `Candidate ${number}`,
      targetDurationSeconds: 150, status: "completed",
      admission: number === 2 ? "candidate" : "included",
      audioFile: `track-${number}.mp3`, durationSeconds: 2 * FRAME_DURATION,
      createdAt: now, updatedAt: now,
    })),
    ...overrides,
  };
}

function taskDirectory(root: string, task = album()): string {
  return path.join(root, "outputs", "tasks", task.workflowType, task.id);
}

async function prepareAlbum(root: string, task = album()): Promise<void> {
  const directory = taskDirectory(root, task);
  await mkdir(path.join(directory, "tracks"), { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify(task));
  for (const track of task.albumTracks ?? []) {
    if (!track.audioFile || /[\\/]/u.test(track.audioFile) || track.audioFile === "missing.mp3") continue;
    await writeFile(path.join(directory, "tracks", track.audioFile), taggedMp3(track.order));
  }
}

function exportAlbum(baseUrl: string, scope?: unknown, taskId = TASK_ID): Promise<Response> {
  return fetch(`${baseUrl}/api/tasks/${taskId}/album/export`, {
    method: "POST", body: JSON.stringify(scope === undefined ? {} : { scope }),
  });
}

async function taskResponse(baseUrl: string): Promise<MusicTask> {
  return await fetch(`${baseUrl}/api/tasks/${TASK_ID}`).then((response) => response.json()) as MusicTask;
}

async function expectInvalidExport(response: Response, status = 400): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toMatchObject({ error: expect.any(String) });
}

describe("album MP3 export", () => {
  it("exports included tracks in playlist order by default and leaves selection and saved task unchanged", async () => {
    await withWebServer(async ({ root, baseUrl }) => {
      const taskPath = path.join(taskDirectory(root), "task.json");
      const savedBefore = await readFile(taskPath, "utf8");
      const before = await taskResponse(baseUrl);
      const response = await exportAlbum(baseUrl);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/mpeg");
      expect(response.headers.get("content-disposition")).toMatch(/^attachment;.*\.mp3/iu);
      expect(response.headers.get("x-album-track-count")).toBe("2");
      expect(Number(response.headers.get("x-album-duration-seconds"))).toBeCloseTo(4 * FRAME_DURATION, 5);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.concat([audioFrames(3), audioFrames(1)]));
      expect(await taskResponse(baseUrl)).toEqual(before);
      expect(await readFile(taskPath, "utf8")).toBe(savedBefore);
    }, { prepare: prepareAlbum });
  });

  it("exports candidates in original track order, includes admitted tracks, and skips excluded tracks", async () => {
    const task = album();
    task.albumTracks![2]!.admission = "excluded";
    task.albumPlaylist = ["track-1"];
    task.albumTracks = [task.albumTracks![2]!, task.albumTracks![0]!, task.albumTracks![1]!];
    await withWebServer(async ({ baseUrl }) => {
      const before = await taskResponse(baseUrl);
      const response = await exportAlbum(baseUrl, "candidate");
      expect(response.status).toBe(200);
      expect(response.headers.get("x-album-track-count")).toBe("2");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.concat([audioFrames(1), audioFrames(2)]));
      expect(await taskResponse(baseUrl)).toEqual(before);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("refreshes exported audio after playlist reordering and exclusion", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const original = await exportAlbum(baseUrl, "included");
      expect(Buffer.from(await original.arrayBuffer())).toEqual(Buffer.concat([audioFrames(3), audioFrames(1)]));

      const reorder = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/playlist`, {
        method: "PUT", body: JSON.stringify({ trackIds: ["track-1", "track-3"] }),
      });
      expect(reorder.status).toBe(200);
      await reorder.json();
      const reordered = await exportAlbum(baseUrl, "included");
      expect(Buffer.from(await reordered.arrayBuffer())).toEqual(Buffer.concat([audioFrames(1), audioFrames(3)]));

      const exclusion = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/tracks/track-3`, {
        method: "PATCH", body: JSON.stringify({ admission: "excluded" }),
      });
      expect(exclusion.status).toBe(200);
      await exclusion.json();
      const included = await exportAlbum(baseUrl, "included");
      expect(included.headers.get("x-album-track-count")).toBe("1");
      expect(Buffer.from(await included.arrayBuffer())).toEqual(taggedMp3(1));
      const candidates = await exportAlbum(baseUrl, "candidate");
      expect(candidates.headers.get("x-album-track-count")).toBe("2");
      expect(Buffer.from(await candidates.arrayBuffer())).toEqual(Buffer.concat([audioFrames(1), audioFrames(2)]));
    }, { prepare: prepareAlbum });
  });

  it("exports a single selected track without requiring a second input", async () => {
    const task = album({ albumPlaylist: ["track-1"] });
    task.albumTracks![2]!.admission = "candidate";
    await withWebServer(async ({ baseUrl }) => {
      const before = await taskResponse(baseUrl);
      const response = await exportAlbum(baseUrl);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-album-track-count")).toBe("1");
      expect(Number(response.headers.get("x-album-duration-seconds"))).toBeCloseTo(2 * FRAME_DURATION, 5);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(taggedMp3(1));
      expect(await taskResponse(baseUrl)).toEqual(before);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("returns a safe downloadable filename for an album title containing Unicode, paths, quotes and controls", async () => {
    const task = album({ title: '晚间 / Noir \\ "Jazz"\r\nAlbum' });
    await withWebServer(async ({ baseUrl }) => {
      const response = await exportAlbum(baseUrl);
      expect(response.status).toBe(200);
      const disposition = response.headers.get("content-disposition")!;
      expect(disposition).toMatch(/^attachment;/u);
      const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(disposition)?.[1];
      const fallback = /filename="([^"]+)"/u.exec(disposition)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : fallback;
      expect(filename).toBeDefined();
      expect(filename).toMatch(/\.mp3$/iu);
      expect(filename).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/u);
      await response.arrayBuffer();
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("rejects an empty included selection or an entirely excluded candidate pool", async () => {
    const task = album({ albumPlaylist: [] });
    for (const track of task.albumTracks!) track.admission = "excluded";
    await withWebServer(async ({ baseUrl }) => {
      await expectInvalidExport(await exportAlbum(baseUrl));
      await expectInvalidExport(await exportAlbum(baseUrl, "candidate"));
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("rejects unfinished selections instead of silently downloading only completed tracks", async () => {
    const task = album();
    task.albumTracks![2]!.status = "failed";
    delete task.albumTracks![2]!.audioFile;
    await withWebServer(async ({ baseUrl }) => {
      const before = await taskResponse(baseUrl);
      await expectInvalidExport(await exportAlbum(baseUrl));
      await expectInvalidExport(await exportAlbum(baseUrl, "candidate"));
      expect(await taskResponse(baseUrl)).toEqual(before);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("rejects incomplete candidates even when the included album is ready", async () => {
    const task = album();
    task.albumTracks![1]!.status = "failed";
    delete task.albumTracks![1]!.audioFile;
    await withWebServer(async ({ baseUrl }) => {
      const included = await exportAlbum(baseUrl);
      expect(included.status).toBe(200);
      await included.arrayBuffer();
      await expectInvalidExport(await exportAlbum(baseUrl, "candidate"));
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it.each([["track-1"], ["track-1", "track-1"], ["track-1", "track-unknown"]])(
    "rejects a saved playlist that does not contain every included track exactly once: %j", async (...trackIds) => {
      const task = album({ albumPlaylist: trackIds });
      await withWebServer(async ({ baseUrl }) => {
        await expectInvalidExport(await exportAlbum(baseUrl));
      }, { prepare: (root) => prepareAlbum(root, task) });
    },
  );

  it.each(["missing.mp3", "../outside.mp3", "..\\outside.mp3"])(
    "rejects unavailable or unsafe selected audio paths: %s", async (audioFile) => {
      const task = album();
      task.albumTracks![0]!.audioFile = audioFile;
      await withWebServer(async ({ root, baseUrl }) => {
        // Even valid audio outside tracks must never become part of an export.
        await writeFile(path.join(taskDirectory(root), "outside.mp3"), taggedMp3(99));
        await expectInvalidExport(await exportAlbum(baseUrl));
      }, { prepare: (root) => prepareAlbum(root, task) });
    },
  );

  it("rejects unsupported scopes and missing or non-album tasks", async () => {
    const task = album({ compositionMode: "single", workflowType: "01-general" });
    await withWebServer(async ({ baseUrl }) => {
      await expectInvalidExport(await exportAlbum(baseUrl, "included"), 404);
      await expectInvalidExport(await exportAlbum(baseUrl, "included", "missing-task"), 404);
    }, { prepare: (root) => prepareAlbum(root, task) });
    await withWebServer(async ({ baseUrl }) => {
      for (const scope of ["all", null, 42]) await expectInvalidExport(await exportAlbum(baseUrl, scope));
    }, { prepare: prepareAlbum });
  });

  it("returns upload timestamps in playlist order using actual audio duration", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const before = await taskResponse(baseUrl);
      const response = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
        method: "POST", body: JSON.stringify({ scope: "included", format: "manifest" }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const manifest = await response.json() as {
        exportId: string; fileName: string; trackCount: number; durationSeconds: number;
        chapters: Array<{ title: string; startSeconds: number; time: string }>;
        timestampsText: string; audioUrl: string;
      };
      expect(manifest.exportId).toEqual(expect.any(String));
      expect(manifest.fileName).toMatch(/\.mp3$/iu);
      expect(manifest.trackCount).toBe(2);
      expect(manifest.durationSeconds).toBeCloseTo(140 * FRAME_DURATION, 6);
      expect(manifest.chapters.map((chapter) => chapter.title)).toEqual(["Candidate 3", "Candidate 1"]);
      expect(manifest.chapters.map((chapter) => chapter.time)).toEqual(["00:00", "00:02"]);
      expect(manifest.chapters[0]!.startSeconds).toBe(0);
      expect(manifest.chapters[1]!.startSeconds).toBeCloseTo(90 * FRAME_DURATION, 6);
      expect(manifest.timestampsText).toMatch(/00:00[^\n]*Candidate 3/u);
      expect(manifest.timestampsText).toMatch(/00:02[^\n]*Candidate 1/u);
      const audio = await fetch(new URL(manifest.audioUrl, baseUrl));
      expect(audio.status).toBe(200);
      expect(Buffer.from(await audio.arrayBuffer())).toEqual(Buffer.concat([audioFrames(3, 90), audioFrames(1, 50)]));
      expect(await taskResponse(baseUrl)).toEqual(before);
    }, {
      prepare: async (root) => {
        await prepareAlbum(root);
        const directory = path.join(taskDirectory(root), "tracks");
        await writeFile(path.join(directory, "track-1.mp3"), taggedMp3(1, 50));
        await writeFile(path.join(directory, "track-3.mp3"), taggedMp3(3, 90));
      },
    });
  });

  it("keeps a manifest audio URL tied to its original snapshot after reordering and exclusion", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
        method: "POST", body: JSON.stringify({ format: "manifest" }),
      });
      expect(response.status).toBe(200);
      const manifest = await response.json() as { audioUrl: string };
      const reorder = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/playlist`, {
        method: "PUT", body: JSON.stringify({ trackIds: ["track-1", "track-3"] }),
      });
      expect(reorder.status).toBe(200);
      await reorder.json();
      const exclusion = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/tracks/track-3`, {
        method: "PATCH", body: JSON.stringify({ admission: "excluded" }),
      });
      expect(exclusion.status).toBe(200);
      await exclusion.json();

      const updated = await exportAlbum(baseUrl);
      expect(updated.status).toBe(200);
      expect(Buffer.from(await updated.arrayBuffer())).toEqual(taggedMp3(1));
      const original = await fetch(new URL(manifest.audioUrl, baseUrl));
      expect(original.status).toBe(200);
      expect(original.headers.get("content-type")).toBe("audio/mpeg");
      expect(Buffer.from(await original.arrayBuffer())).toEqual(Buffer.concat([audioFrames(3), audioFrames(1)]));
    }, { prepare: prepareAlbum });
  });

  it("rejects unsupported export formats", async () => {
    await withWebServer(async ({ baseUrl }) => {
      for (const format of ["wav", "json", null, 42]) {
        await expectInvalidExport(await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
          method: "POST", body: JSON.stringify({ format }),
        }));
      }
    }, { prepare: prepareAlbum });
  });

  it("preserves a final emoji when shortening an album filename for download", async () => {
    const title = "a".repeat(95) + "🎵";
    const task = album({ title });
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
        method: "POST", body: JSON.stringify({ format: "manifest" }),
      });
      expect(response.status).toBe(200);
      const manifest = await response.json() as { fileName: string; audioUrl: string };
      expect(manifest.fileName).toBe(title + ".mp3");
      const audio = await fetch(new URL(manifest.audioUrl, baseUrl));
      expect(audio.status).toBe(200);
      const disposition = audio.headers.get("content-disposition")!;
      const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(disposition)?.[1];
      expect(encoded).toBeDefined();
      const filename = decodeURIComponent(encoded!);
      expect(filename).toBe(manifest.fileName);
      expect(() => encodeURIComponent(filename)).not.toThrow();
      expect(filename).toContain("🎵");
      expect(Buffer.from(await audio.arrayBuffer())).toEqual(Buffer.concat([audioFrames(3), audioFrames(1)]));
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("downloads timestamps as a UTF-8 text attachment from the original export snapshot", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
        method: "POST", body: JSON.stringify({ format: "manifest" }),
      });
      expect(response.status).toBe(200);
      const manifest = await response.json() as { timestampsUrl: string; timestampsText: string };
      expect(manifest.timestampsUrl).toEqual(expect.any(String));
      const reorder = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/playlist`, {
        method: "PUT", body: JSON.stringify({ trackIds: ["track-1", "track-3"] }),
      });
      expect(reorder.status).toBe(200);
      await reorder.json();

      const download = await fetch(new URL(manifest.timestampsUrl, baseUrl));
      expect(download.status).toBe(200);
      expect(download.headers.get("content-type")).toMatch(/^text\/plain;\s*charset=utf-8$/iu);
      const disposition = download.headers.get("content-disposition")!;
      expect(disposition).toMatch(/^attachment;/u);
      const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(disposition)?.[1];
      const fallback = /filename="([^"]+)"/u.exec(disposition)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : fallback;
      expect(filename).toMatch(/\.txt$/iu);
      expect(await download.text()).toBe(manifest.timestampsText);

      const currentResponse = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/album/export`, {
        method: "POST", body: JSON.stringify({ format: "manifest" }),
      });
      expect(currentResponse.status).toBe(200);
      const current = await currentResponse.json() as { timestampsText: string };
      expect(current.timestampsText).not.toBe(manifest.timestampsText);
    }, { prepare: prepareAlbum });
  });
});
