import type { AriosoConfig } from "../config/env.js";
import type { MusicTask, TaskStore } from "../web/task-store.js";
import { pipelineCommand, produceAlbum, type PipelineCommand } from "./pipeline.js";
import type { AlbumProduction } from "./types.js";

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
    const result = await produceAlbum(store, current, command, async (message) => progress({ message }));
    await progress({ ...result, status: "completed", stage: "delivery", message: "Audio and video exports verified. Listening review is pending." });
    await store.update(task.id, { status: "completed", error: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await progress({ status: "failed", error: message });
    await store.update(task.id, { status: "failed", error: message });
    throw error;
  }
}
