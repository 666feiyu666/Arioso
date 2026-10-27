import { measureAudioDuration } from "../audio/stitch.js";
import {
  composeAlbumTrack,
  composeMusic,
  composeOrchestralMovement,
  planAlbum,
  planOrchestralWork,
  planPlaylist,
  reviewAlbumCandidates,
  reviseAlbumTrack,
} from "../composer/bounded-agent.js";
import { timeoutsFor, type AriosoConfig } from "../config/env.js";
import type { InterfaceLanguage } from "../config/settings.js";
import { runMoodMicGeneration } from "../moodmic/moodmic-graph.js";
import { runBackgroundMusicProducer } from "../producer/background-music-producer.js";
import type { MusicRetrievalTrace } from "../retrieval/music-retriever.js";
import type { AlbumPlan } from "../schema/album-plan.js";
import { dispatchGeneration } from "./generation.js";
import type { MusicTask, TaskStore } from "./task-store.js";

/**
 * Task execution, independent of any transport. The HTTP handlers and the CLI
 * both drive tasks through this module; neither imports the other's adapter.
 */

/**
 * Process-local reservation of tasks that have a live runner. It is not a
 * cross-process lock: a second server or CLI process does not coordinate here.
 */
export class TaskAdmission {
  readonly #active = new Set<string>();

  /** Reserves the single execution owner for a task. */
  reserve(id: string): boolean {
    if (this.#active.has(id)) return false;
    this.#active.add(id);
    return true;
  }

  release(id: string): void {
    this.#active.delete(id);
  }

  has(id: string): boolean {
    return this.#active.has(id);
  }
}

export async function runTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
  albumTrackId?: string,
  language?: InterfaceLanguage,
): Promise<void> {
  try {
    if (task.compositionMode === "album") {
      if (task.albumProduction) {
        await runBackgroundMusicProducer(store, task, config, () => runAlbumTask(store, store.get(task.id) ?? task, config, albumTrackId));
      } else {
        await runAlbumTask(store, task, config, albumTrackId);
      }
      return;
    }
    if (task.compositionMode === "orchestral") {
      await runOrchestralTask(store, task, config);
      return;
    }

    let spec = task.musicSpec;
    if (!spec) {
      await store.update(task.id, { status: "composing", error: undefined });
      spec = await composeMusic(task.description, {
        apiKey: config.openAiApiKey,
        model: task.composerModel,
        lyriaModel: task.lyriaModel,
        vocalMode: task.vocalMode ?? "auto",
        corpusMode: task.corpusMode ?? "none",
        ...(task.musicType ? { musicType: task.musicType } : {}),
        onMusicRetrieval: async (trace: MusicRetrievalTrace) => {
          await store.update(task.id, { musicRetrieval: trace });
        },
      });
      await store.update(task.id, { musicSpec: spec, title: spec.title });
    }

    if (task.mode === "compose") {
      await store.update(task.id, { status: "completed", error: undefined });
      return;
    }

    // MoodMic shows the composed Lyria prompt for confirmation before the first
    // generation. The confirm endpoint flips the flag and re-enters here, where
    // the spec already exists, so the pause is skipped on the second pass.
    if (task.moodChatId && !task.lyriaPromptApproved) {
      await store.update(task.id, { status: "planning", error: undefined });
      return;
    }

    // MoodMic creations run the generation check: generate, let Gemini listen,
    // then deliver or pause for the user's regenerate/keep decision.
    if (task.moodChatId) {
      await runMoodMicGeneration(store, store.get(task.id) ?? task, config, {
        ...(language ? { language } : {}),
      });
      return;
    }

    await store.update(task.id, { status: "generating", error: undefined });
    const generated = await dispatchGeneration(store, store.get(task.id) ?? task, {
      purpose: "generate",
      model: task.lyriaModel,
      prompt: spec.lyriaPrompt,
      apiKey: config.geminiApiKey!,
      timeoutMs: timeoutsFor(config).generateMs,
    });
    const latestTask = store.get(task.id) ?? task;
    const audioFile = await store.writeAudio(latestTask, generated.audio);
    await store.update(task.id, {
      status: "completed",
      audioFile,
      generatedText: generated.generatedText,
      error: undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.update(task.id, { status: "failed", error: message });
  }
}

export async function runOrchestralTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
): Promise<void> {
  let currentTask = task;
  let workPlan = currentTask.orchestralPlan;

  if (!workPlan) {
    await store.update(currentTask.id, { status: "composing", error: undefined });
    workPlan = await planOrchestralWork(currentTask.description, {
      apiKey: config.openAiApiKey,
      model: currentTask.composerModel,
      lyriaModel: currentTask.lyriaModel,
    });
    const now = new Date().toISOString();
    currentTask = await store.update(currentTask.id, {
      title: workPlan.title,
      orchestralPlan: workPlan,
      movements: workPlan.movements.map((movement) => ({
        id: crypto.randomUUID(),
        order: movement.order,
        title: movement.title,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      })),
    });
  }

  for (const movement of currentTask.movements ?? []) {
    if (movement.status === "completed") continue;

    try {
      let movementPlan = movement.plan;
      if (!movementPlan) {
        await store.update(currentTask.id, { status: "composing", error: undefined });
        await store.updateMovement(currentTask.id, movement.id, {
          status: "composing",
          error: undefined,
        });
        movementPlan = await composeOrchestralMovement(workPlan, movement.order, {
          apiKey: config.openAiApiKey,
          model: currentTask.composerModel,
          lyriaModel: currentTask.lyriaModel,
        });
        currentTask = await store.updateMovement(currentTask.id, movement.id, {
          title: movementPlan.title,
          plan: movementPlan,
          status: currentTask.mode === "compose" ? "completed" : "queued",
          error: undefined,
        });
      }

      if (currentTask.mode === "compose") continue;

      await store.update(currentTask.id, { status: "generating", error: undefined });
      await store.updateMovement(currentTask.id, movement.id, {
        status: "generating",
        error: undefined,
      });
      const generated = await dispatchGeneration(store, store.get(currentTask.id) ?? currentTask, {
        purpose: "movement",
        model: currentTask.lyriaModel,
        prompt: movementPlan.lyriaPrompt,
        apiKey: config.geminiApiKey!,
        timeoutMs: timeoutsFor(config).generateMs,
      });
      const currentMovement = currentTask.movements?.find(
        (candidate) => candidate.id === movement.id,
      ) ?? movement;
      const audioFile = await store.writeMovementAudio(
        currentTask,
        currentMovement,
        generated.audio,
      );
      currentTask = await store.updateMovement(currentTask.id, movement.id, {
        status: "completed",
        audioFile,
        generatedText: generated.generatedText,
        error: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateMovement(currentTask.id, movement.id, {
        status: "failed",
        error: message,
      });
      throw error;
    }
  }

  if (currentTask.mode === "compose") {
    await store.update(currentTask.id, { status: "completed", error: undefined });
    return;
  }

  currentTask = store.get(currentTask.id) ?? currentTask;
  await store.update(currentTask.id, { status: "assembling", error: undefined });
  const assembled = await store.assembleOrchestralAudio(currentTask);
  await store.update(currentTask.id, {
    status: "completed",
    audioFile: assembled.audioFile,
    orchestralAssembly: assembled.assembly,
    error: undefined,
  });
}

export async function runAlbumTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
  retryTrackId?: string,
): Promise<void> {
  let current = store.get(task.id) ?? task;
  if (current.status === "completed" && current.albumPromptsReady
    && current.albumTracks?.length && current.albumTracks.every((track) =>
      track.status === "completed" && (current.mode === "compose" || Boolean(track.audioFile)))) return;
  const generationTrackId = current.albumPromptsReady ? retryTrackId : undefined;
  const options = {
    apiKey: config.openAiApiKey,
    model: current.composerModel,
    lyriaModel: current.lyriaModel,
  };
  if (!current.albumPlan) {
    await store.update(task.id, { status: "composing", error: undefined });
    const references = current.playlistReferences ?? [];
    const now = new Date().toISOString();
    const outlineTracks = (plan: AlbumPlan) => plan.tracks.map((outline) => ({
      id: crypto.randomUUID(), order: outline.number, title: outline.title,
      targetDurationSeconds: outline.targetSeconds,
      admission: "candidate" as const, status: "queued" as const, createdAt: now, updatedAt: now,
    }));
    if (current.workflowType === "05-playlist") {
      const { plan, briefing } = await planPlaylist(current.description, {
        ...options,
        candidateCount: current.albumCandidateCount ?? 14,
        targetTotalMinutes: current.albumTargetTotalMinutes ?? 35,
        ...(references.length ? { references } : {}),
      });
      current = await store.update(task.id, {
        title: plan.albumTitle, albumPlan: plan, albumPlaylist: [],
        playlistBriefing: briefing, playlistDiscussion: [], playlistPlanApproved: false,
        albumPlanRevision: (current.albumPlanRevision ?? 0) + 1,
        albumTracks: outlineTracks(plan),
      });
      // Pause for the user to confirm the author's reading before paying for generation.
      await store.update(task.id, { status: "review", error: undefined });
      return;
    }
    const plan = await planAlbum(current.description, {
      ...options,
      candidateCount: current.albumCandidateCount ?? 14,
      targetTotalMinutes: current.albumTargetTotalMinutes ?? 35,
      ...(references.length ? { references } : {}),
    });
    current = await store.update(task.id, {
      title: plan.albumTitle, albumPlan: plan, albumPlaylist: [],
      albumPlanRevision: (current.albumPlanRevision ?? 0) + 1,
      albumTracks: outlineTracks(plan),
    });
  }
  const plan = current.albumPlan!;
  if (current.workflowType === "05-playlist" && !current.playlistPlanApproved) {
    // A playlist that resumes before the user confirms stays paused.
    await store.update(task.id, { status: "review", error: undefined });
    return;
  }
  if (!current.albumPromptsReady) {
    await store.update(task.id, { status: "composing", error: undefined });
    for (const track of current.albumTracks ?? []) {
      if (track.musicSpec) continue;
      await store.updateAlbumTrack(task.id, track.id, { status: "composing", error: undefined });
      try {
        const musicSpec = await composeAlbumTrack(plan, track.order, options);
        current = await store.updateAlbumTrack(task.id, track.id, {
          musicSpec, title: musicSpec.title, status: "queued", error: undefined,
        });
      } catch (error) {
        await store.updateAlbumTrack(task.id, track.id, {
          status: "failed", error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    const orderedSpecs = () => {
      const tracks = [...(store.get(task.id)?.albumTracks ?? [])].sort((a, b) => a.order - b.order);
      if (tracks.length !== plan.tracks.length || tracks.some((track) => !track.musicSpec)) {
        throw new Error("Album candidate prompts are incomplete.");
      }
      return tracks.map((track) => track.musicSpec!);
    };
    current = store.get(task.id) ?? current;
    if (!current.albumReview) {
      const albumReview = await reviewAlbumCandidates(plan, orderedSpecs(), options);
      current = await store.update(task.id, { albumReview });
    }
    for (const finding of current.albumReview!.candidates) {
      if (finding.verdict !== "needs-work" || !finding.revisionBrief
        || current.albumRevisedTrackNumbers?.includes(finding.number)) continue;
      const track = current.albumTracks?.find((candidate) => candidate.order === finding.number);
      if (!track?.musicSpec) throw new Error(`Missing candidate ${finding.number}.`);
      const musicSpec = await reviseAlbumTrack(
        plan, finding.number, track.musicSpec, finding.revisionBrief, orderedSpecs(), options,
      );
      current = store.get(task.id) ?? current;
      current = await store.update(task.id, {
        albumTracks: current.albumTracks!.map((candidate) => candidate.id === track.id
          ? { ...candidate, musicSpec, title: musicSpec.title, updatedAt: new Date().toISOString() }
          : candidate),
        albumRevisedTrackNumbers: [...(current.albumRevisedTrackNumbers ?? []), finding.number],
      });
    }
    if (!current.albumFinalReview) {
      const albumFinalReview = await reviewAlbumCandidates(plan, orderedSpecs(), options);
      current = await store.update(task.id, { albumFinalReview });
    }
    current = await store.update(task.id, { albumPromptsReady: true });
  }
  if (current.mode === "compose") {
    for (const track of current.albumTracks ?? []) {
      await store.updateAlbumTrack(task.id, track.id, { status: "completed", error: undefined });
    }
    await store.update(task.id, { status: "completed", error: undefined });
    return;
  }
  if (!current.albumTracks?.length) throw new Error("Album candidate tracks are missing.");
  await store.update(task.id, { status: "generating", error: undefined });
  for (const track of current.albumTracks) {
    if (generationTrackId && track.id !== generationTrackId) continue;
    if (track.audioFile && track.status === "completed") continue;
    try {
      if (!track.musicSpec) throw new Error("Candidate prompt is missing.");
      await store.updateAlbumTrack(task.id, track.id, { status: "generating", error: undefined });
      const generated = await dispatchGeneration(store, store.get(task.id) ?? current, {
        purpose: "album-track",
        model: current.lyriaModel,
        prompt: track.musicSpec.lyriaPrompt,
        apiKey: config.geminiApiKey!,
        timeoutMs: timeoutsFor(config).generateMs,
      });
      const audioFile = await store.writeAlbumTrackAudio(current, track, generated.audio);
      let durationSeconds: number | undefined;
      try {
        durationSeconds = measureAudioDuration(generated.audio);
      } catch {
        // Audio stays available when its duration cannot be measured locally.
      }
      await store.updateAlbumTrack(task.id, track.id, {
        status: "completed", audioFile, generatedText: generated.generatedText,
        ...(durationSeconds === undefined ? {} : { durationSeconds }), error: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateAlbumTrack(task.id, track.id, { status: "failed", error: message });
    }
  }
  const failures = (store.get(task.id)?.albumTracks ?? [])
    .filter((track) => track.status !== "completed")
    .map((track) => `Candidate ${track.order}: ${track.error ?? "Awaiting generation."}`);
  await store.update(task.id, {
    status: failures.length ? "failed" : "completed",
    error: failures.length ? failures.join(" ") : undefined,
  });
}
