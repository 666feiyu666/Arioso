import type { AriosoConfig } from "../config/env.js";
import type { MusicTask, TaskStore } from "../web/task-store.js";
import { pipelineCommand, produceAlbum, type PipelineCommand } from "./pipeline.js";
import type { AlbumProduction } from "./types.js";

function pipelineProgress(line: string, task: MusicTask): AlbumProduction["progress"] | undefined {
  const previous = task.albumProduction?.progress;
  const total = task.albumProduction?.trackIds?.length
    ?? task.albumTracks?.filter((track) => track.admission !== "excluded").length ?? 0;
  const titleFor = (number: number) => [...(task.albumTracks ?? [])]
    .filter((track) => track.admission !== "excluded").sort((left, right) => left.order - right.order)[number - 1]?.title;
  const checking = /^Checking (\d+) track checkpoint\(s\)$/u.exec(line);
  if (checking) return { step: "checking", completedTracks: 0, totalTracks: Number(checking[1]) };
  const active = /^\[(\d+)\/(\d+)\] (?:Decoding (.+)|Historical denoising|Reusing verified denoise checkpoint)$/u.exec(line);
  if (active) {
    const number = Number(active[1]);
    const reused = line.endsWith("Reusing verified denoise checkpoint");
    const title = active[3] || titleFor(number);
    return { step: "denoising", completedTracks: reused
      ? Math.min(Number(active[2]), (previous?.step === "denoising" ? previous.completedTracks : 0) + 1)
      : previous?.step === "denoising" ? previous.completedTracks : 0,
    totalTracks: Number(active[2]), currentTrackNumber: number,
    ...(title ? { currentTrackTitle: title } : {}) };
  }
  const completed = /^\[(\d+)\/(\d+) complete\] Track (\d+): (.+)$/u.exec(line);
  if (completed) return { step: "denoising", completedTracks: Number(completed[1]),
    totalTracks: Number(completed[2]), currentTrackNumber: Number(completed[3]),
    ...(completed[4] ? { currentTrackTitle: completed[4] } : {}) };
  const exported = /^\[(\d+)\/(\d+)\] Reusing verified PCM export$/u.exec(line);
  if (line.startsWith("Applying one album gain") || exported) {
    const number = exported ? Number(exported[1]) : undefined;
    const title = number ? titleFor(number) : undefined;
    return { step: "exporting", completedTracks: total, totalTracks: total,
      ...(number ? { currentTrackNumber: number } : {}), ...(title ? { currentTrackTitle: title } : {}) };
  }
  if (line.startsWith("Concatenating PCM tracks") || line.startsWith("Reusing verified concatenated")) {
    return { step: "assembling", completedTracks: total, totalTracks: total };
  }
  if (line.startsWith("Creating 1080p") || line.startsWith("Reusing verified MP4")
    || line.startsWith("Recovered and reused existing verified MP4")) {
    return { step: "video", completedTracks: total, totalTracks: total };
  }
  return previous;
}

/** Own the album lifecycle while specialist agents retain musical decisions. */
export async function runBackgroundMusicProducer(
  store: TaskStore, task: MusicTask, config: AriosoConfig,
  compose: () => Promise<void>, command: PipelineCommand = pipelineCommand(config),
): Promise<void> {
  if (task.compositionMode !== "album" || task.mode !== "generate" || !task.albumProduction) {
    throw new Error("Background Music Producer requires an instrumental album generation task.");
  }
  if (task.status === "completed" && task.albumProduction.status === "completed") return;
  const progress = async (changes: Partial<AlbumProduction>) => {
    const current = store.get(task.id)!;
    await store.update(task.id, { albumProduction: { ...current.albumProduction!, ...changes } });
  };
  try {
    await progress({ status: "checking", stage: "runtime", error: undefined });
    // Fail before paid composition or generation if the installed pipeline is unavailable.
    await command(["doctor"]);
    await progress({ status: "composing", stage: "composition" });
    await compose();
    let current = store.get(task.id)!;
    if (current.status !== "completed") throw new Error(current.error || "Album generation is incomplete.");
    if (current.albumProduction?.status === "completed") return;
    await store.update(task.id, { status: "processing", error: undefined });
    await progress({ status: "processing", stage: "postproduction", message: "Preparing generated candidates for denoising." });
    current = store.get(task.id)!;
    const result = await produceAlbum(store, current, command, async (message) => {
      const latest = store.get(task.id)!;
      const parsed = pipelineProgress(message, latest);
      await progress(parsed ? { message, progress: parsed } : { message });
    });
    await progress({ ...result, status: "completed", stage: "delivery",
      progress: { step: result.videoCreated ? "video" : "assembling",
        completedTracks: result.trackIds.length, totalTracks: result.trackIds.length },
      message: result.videoCreated
        ? "Audio and video exports verified. Listening review is pending."
        : "Denoised audio exports verified. MP4 skipped because cover.png was not provided." });
    await store.update(task.id, { status: "completed", error: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await progress({ status: "failed", error: message });
    await store.update(task.id, { status: "failed", error: message });
    throw error;
  }
}
