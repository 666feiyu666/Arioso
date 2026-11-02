import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { measureAudioDuration, stitchAudioFiles } from "../audio/stitch.js";
import type { Playlist } from "../playlist/playlist.js";
import { playlistItemAudioPath, resolvePlaylistItem, type PieceLookup } from "./playlist-pieces.js";
import { isSafeFileName } from "../utils/safe-name.js";

export interface PlaylistChapter {
  title: string;
  startSeconds: number;
  time: string;
}

export interface PlaylistAudioExport {
  exportId: string;
  outputPath: string;
  fileName: string;
  trackCount: number;
  durationSeconds: number;
  chapters: PlaylistChapter[];
  timestampsText: string;
  /** Entries that could not be exported because their piece no longer resolves. */
  skipped: string[];
}

function timestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function safeExportName(value: string, fallback: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  const name = Array.from(normalized).slice(0, 80).join("").replace(/[. ]+$/g, "") || fallback;
  return `${isSafeFileName(name) ? name : `_${name}`}.mp3`;
}

/**
 * Joins a playlist's resolvable pieces into one MP3 with per-track timestamps.
 * Exporting copies and stitches audio that already exists; it never composes or
 * generates, so a playlist with a missing piece still exports what is left.
 */
export async function exportPlaylistAudio(
  playlist: Playlist,
  tasks: PieceLookup,
  directory: string,
): Promise<PlaylistAudioExport> {
  const skipped: string[] = [];
  const selected: Array<{ title: string; file: string }> = [];
  for (const item of playlist.items) {
    const resolved = resolvePlaylistItem(item, tasks);
    const file = playlistItemAudioPath(item, tasks);
    if (resolved.missing || !file) {
      skipped.push(resolved.titleSnapshot);
      continue;
    }
    selected.push({ title: resolved.titleSnapshot, file });
  }
  if (!selected.length) throw new Error("This playlist has no playable pieces to export.");

  const sources = await Promise.all(selected.map(async (entry) => {
    const info = await stat(entry.file);
    if (!info.isFile()) throw new Error(`A playlist piece is not available: ${entry.title}`);
    return { file: entry.file, size: info.size, modified: info.mtimeMs };
  }));
  const fileName = safeExportName(playlist.name, playlist.id);
  const exportId = createHash("sha256")
    .update(JSON.stringify(["playlist-mp3-v1", playlist.id, fileName, sources]))
    .digest("hex");
  const outputPath = path.join(directory, "exports", `${exportId}.mp3`);
  await mkdir(path.dirname(outputPath), { recursive: true });

  const inputFiles = selected.map((entry) => entry.file);
  let segmentDurations: number[];
  if (inputFiles.length === 1) {
    await copyFile(inputFiles[0]!, outputPath);
    segmentDurations = [measureAudioDuration(await readFile(outputPath))];
  } else {
    const stitched = await stitchAudioFiles(outputPath, inputFiles);
    segmentDurations = stitched.segmentDurationsSeconds;
  }

  let elapsed = 0;
  const chapters = selected.map((entry, index) => {
    const chapter = { title: entry.title, startSeconds: elapsed, time: timestamp(elapsed) };
    elapsed += segmentDurations[index] ?? 0;
    return chapter;
  });
  const timestampsText = chapters.map((chapter) => `${chapter.time} ${chapter.title}`).join("\n") + "\n";
  return {
    exportId,
    outputPath,
    fileName,
    trackCount: selected.length,
    durationSeconds: elapsed,
    chapters,
    timestampsText,
    skipped,
  };
}
