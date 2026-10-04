import { config as dotenv } from "dotenv";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { buildAlbumLyriaPrompt } from "../composer/album-prompt.js";
import { loadConfig } from "../config/env.js";
import { AlbumPlanSchema } from "../schema/album-plan.js";
import { MusicSpecSchema } from "../schema/music-spec.js";
import { writeTextFileAtomic } from "../utils/files.js";
import { runAlbumTask } from "../web/server.js";
import { TaskStore } from "../web/task-store.js";

/** Import the reviewed study without altering its original prompts or review evidence. */
async function main(): Promise<void> {
  dotenv({ quiet: true });
  const generate = process.argv.includes("--generate");
  const config = loadConfig(generate);
  const study = path.resolve("experiments", "late-night-noir-album-prompt-study", "results");
  const markerPath = path.join(study, "frontend-album.json");
  const store = new TaskStore(path.resolve(config.outputDirectory, "tasks"));
  await store.initialize({ markInterrupted: false });

  let albumId: string | undefined;
  try {
    const marker = JSON.parse(await readFile(markerPath, "utf8")) as { taskId?: unknown };
    if (typeof marker.taskId === "string") albumId = marker.taskId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let task = albumId ? store.get(albumId) : undefined;
  if (task && task.compositionMode !== "album") throw new Error("The study marker is not an album task.");

  if (!task) {
    const raw = JSON.parse(await readFile(path.join(study, "final-plan.json"), "utf8"));
    const plan = AlbumPlanSchema.parse(JSON.parse(JSON.stringify(raw).replace(/hollow[- ]body piano/gi, "acoustic piano")));
    const tracks = await Promise.all(plan.tracks.map(async (track) => {
      const original = await readFile(path.join(study, "final", `${String(track.number).padStart(2, "0")}.spec.json`), "utf8");
      const spec = MusicSpecSchema.parse(JSON.parse(original.replace(/hollow[- ]body piano/gi, "acoustic piano")));
      spec.lyriaPrompt = buildAlbumLyriaPrompt(plan, track.number, spec);
      return { order: track.number, title: spec.title, targetDurationSeconds: track.targetSeconds, musicSpec: spec };
    }));
    task = await store.createPreparedAlbum({ description: "Late night noir jazz for relaxation. Instrumental only. First batch of 14 candidates.", plan, tracks }, config);
    await writeTextFileAtomic(markerPath, `${JSON.stringify({ taskId: task.id, importedAt: new Date().toISOString(), source: "final study MusicSpecs", changes: ["Accurate acoustic-piano naming", "Track-ready structured prompt rendering"], admission: "All tracks remain candidates" }, null, 2)}\n`);
  }
  console.log(`Album: ${task.id}; ${task.albumTracks?.length ?? 0} candidates.`);
  if (generate) {
    // The same production runner is used by the HTTP API, with per-track checkpoints.
    await runAlbumTask(store, task, config);
    task = store.get(task.id)!;
    const completed = task.albumTracks?.filter((track) => track.status === "completed" && track.audioFile) ?? [];
    for (const track of completed) {
      const audio = store.albumTrackAudioPath(task, track);
      if (!audio || !(await stat(audio)).isFile()) throw new Error("A completed candidate is missing its audio file.");
    }
    console.log(`Audio complete: ${completed.length}/${task.albumTracks?.length ?? 0}; total ${completed.reduce((sum, track) => sum + (track.durationSeconds ?? 0), 0).toFixed(1)} seconds; state ${task.status}.`);
    if (task.status !== "completed") process.exitCode = 1;
  }
}

try { await main(); }
catch (error) {
  const item = error as { name?: unknown; status?: unknown };
  console.error(`Album study stopped: ${typeof item.name === "string" ? item.name : "Error"}${typeof item.status === "number" ? ` (${item.status})` : ""}. Existing checkpoints are preserved.`);
  process.exitCode = 1;
}