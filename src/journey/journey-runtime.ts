import type { AriosoConfig } from "../config/env.js";
import type { PlaylistReference } from "../playlist/reference.js";
import type { MusicTask, TaskStore } from "../web/task-store.js";
import { transitionJourney, JourneyTransitionError, type JourneyEvent } from "./journey-graph.js";
import type { JourneyStore } from "./journey-store.js";
import type { MusicJourney } from "./types.js";

/**
 * Journeys link existing artifacts; the runtime only translates the state of
 * those artifacts into validated Journey transitions and persists each one.
 * Task creation, planning, and audio generation stay with TaskStore and the
 * existing composer/producer components.
 */

export interface JourneyView {
  journey: MusicJourney;
  songTask: MusicTask | null;
  albumTask: MusicTask | null;
}

export interface ContinueAlbumInput {
  theme: string;
  candidateCount?: number;
  targetTotalMinutes?: number;
  songTaskId?: string;
}

const ACTIVE_TASK_STATUSES = ["queued", "composing", "generating", "assembling", "processing"];

export class JourneyRuntime {
  readonly #tasks: TaskStore;
  readonly #journeys: JourneyStore;

  constructor(deps: { tasks: TaskStore; journeys: JourneyStore }) {
    this.#tasks = deps.tasks;
    this.#journeys = deps.journeys;
  }

  find(identifier: string): MusicJourney | undefined {
    return this.#journeys.find(identifier);
  }

  require(identifier: string): MusicJourney {
    const journey = this.find(identifier);
    if (!journey) throw new JourneyTransitionError("Journey not found.");
    return journey;
  }

  view(journey: MusicJourney): JourneyView {
    return {
      journey,
      songTask: journey.songTaskId ? this.#tasks.get(journey.songTaskId) ?? null : null,
      albumTask: journey.albumTaskId ? this.#tasks.get(journey.albumTaskId) ?? null : null,
    };
  }

  journeyForTask(task: MusicTask): MusicJourney | undefined {
    if (task.journeyId) {
      const direct = this.#journeys.get(task.journeyId);
      if (direct) return direct;
    }
    return task.moodChatId ? this.#journeys.findByChatId(task.moodChatId) : undefined;
  }

  /** Start (or find) the journey for a MoodMic creation. */
  async startForMoodChat(input: {
    moodChatId: string;
    songTaskId?: string;
    moodEntryId?: string;
  }): Promise<MusicJourney> {
    const journey = await this.#journeys.create(input);
    return this.sync(journey.id);
  }

  async linkMoodEntry(journeyId: string, moodEntryId: string): Promise<MusicJourney> {
    const journey = this.#journeys.get(journeyId);
    if (!journey || journey.moodEntryId === moodEntryId) return journey ?? this.require(journeyId);
    return this.#journeys.update(journeyId, { moodEntryId });
  }

  /**
   * Translate the current task statuses into the journey's phase. This is what
   * makes a refresh (or a background run finishing) restore the right stage.
   */
  async sync(identifier: string): Promise<MusicJourney> {
    let journey = this.require(identifier);
    // A single task status can advance more than one stage; derive until stable.
    // A derived event the graph does not allow (an out-of-order record) simply
    // stops the walk: reading a journey must never fail because of it.
    for (let step = 0; step < 4; step += 1) {
      const event = this.#deriveEvent(journey);
      if (!event) break;
      const next = await this.#tryApply(journey, event);
      if (next === journey) break;
      journey = next;
    }
    return journey;
  }

  #deriveEvent(journey: MusicJourney): JourneyEvent | undefined {
    const song = journey.songTaskId ? this.#tasks.get(journey.songTaskId) : undefined;
    const album = journey.albumTaskId ? this.#tasks.get(journey.albumTaskId) : undefined;
    switch (journey.phase) {
      case "mood":
        return song ? { type: "song-submitted" } : undefined;
      case "song-running":
      case "song-review": {
        if (!song) return undefined;
        if (song.status === "failed") return { type: "song-failed", ...(song.error ? { error: song.error } : {}) };
        if (song.status === "review") return { type: "song-reviewing" };
        if (song.status === "completed") return { type: "song-kept" };
        return undefined;
      }
      case "album-planning":
      case "album-review":
      case "album-running":
      case "album-curation": {
        if (!album) return undefined;
        if (album.status === "failed") return { type: "album-failed", ...(album.error ? { error: album.error } : {}) };
        if (album.status === "completed" && journey.phase !== "album-curation") {
          return { type: "album-complete" };
        }
        if (album.status === "review") {
          if (journey.phase === "album-planning") {
            return { type: "plan-ready", albumTaskId: album.id };
          }
          // Approval was persisted but the dispatch never reached the runner.
          if (journey.phase === "album-review" && journey.approvedPlanRevision) {
            return { type: "plan-approved", revision: journey.approvedPlanRevision };
          }
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  /** Apply an event if the graph allows it for the current phase. */
  async #apply(
    journey: MusicJourney,
    event: JourneyEvent,
    extra: Partial<MusicJourney> = {},
  ): Promise<MusicJourney> {
    let transition;
    try {
      transition = await transitionJourney(journey, event);
    } catch (error) {
      if (error instanceof JourneyTransitionError) {
        throw error;
      }
      throw new JourneyTransitionError(
        error instanceof Error ? error.message : String(error),
      );
    }
    const changes: Partial<MusicJourney> = { ...extra, phase: transition.phase };
    if (transition.approvedPlanRevision === null) {
      delete changes.approvedPlanRevision;
    } else if (typeof transition.approvedPlanRevision === "number") {
      changes.approvedPlanRevision = transition.approvedPlanRevision;
    }
    if (transition.error !== undefined) changes.error = transition.error ?? undefined;
    return this.#journeys.update(journey.id, changes);
  }

  async #tryApply(journey: MusicJourney, event: JourneyEvent, extra: Partial<MusicJourney> = {}): Promise<MusicJourney> {
    try {
      return await this.#apply(journey, event, extra);
    } catch (error) {
      if (error instanceof JourneyTransitionError) return journey;
      throw error;
    }
  }

  // --- stage notifications -------------------------------------------------

  /** A fresh MoodMic attempt inside the same conversation continues its journey. */
  async adoptSongTask(moodChatId: string, task: MusicTask): Promise<MusicJourney | undefined> {
    const journey = this.#journeys.findByChatId(moodChatId);
    if (!journey || journey.albumTaskId) return journey;
    return this.#tryApply(journey, { type: "song-submitted" }, { songTaskId: task.id });
  }

  async noteSongRegenerating(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "song-regenerating" });
  }

  async noteSongFailed(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "song-failed", ...(task.error ? { error: task.error } : {}) });
  }

  async noteSongReady(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "song-kept" });
  }

  async notePlanReady(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "plan-ready", albumTaskId: task.id });
  }

  async notePlanRevised(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "plan-revised" });
  }

  async noteAlbumFinished(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    const event: JourneyEvent = task.status === "failed"
      ? { type: "album-failed", ...(task.error ? { error: task.error } : {}) }
      : { type: "album-complete" };
    await this.#tryApply(this.require(journey.id), event);
  }

  async noteAlbumExported(task: MusicTask): Promise<void> {
    const journey = this.journeyForTask(task);
    if (!journey) return;
    await this.#tryApply(journey, { type: "finish" });
  }

  // --- user actions --------------------------------------------------------

  /**
   * Bind an album to one exact, user-kept song. Repeated requests return the
   * album that already exists instead of planning a second one.
   */
  async continueAlbum(
    identifier: string,
    input: ContinueAlbumInput,
    config: AriosoConfig,
  ): Promise<{ journey: MusicJourney; task: MusicTask; created: boolean }> {
    const journey = await this.sync(identifier);
    const existing = journey.albumTaskId ? this.#tasks.get(journey.albumTaskId) : undefined;
    if (existing) return { journey, task: existing, created: false };

    const songTaskId = input.songTaskId ?? journey.songTaskId;
    const song = songTaskId ? this.#tasks.get(songTaskId) : undefined;
    if (!song) throw new JourneyTransitionError("The song for this journey is unavailable.");
    if (song.moodChatId !== journey.moodChatId) {
      throw new JourneyTransitionError("That song belongs to another conversation.");
    }
    if (song.status !== "completed" || !song.audioFile || !song.musicSpec) {
      throw new JourneyTransitionError("Keep a finished song before planning an album from it.");
    }
    if (journey.phase !== "song-ready") {
      throw new JourneyTransitionError("This journey is not ready to plan an album.");
    }
    const theme = input.theme.trim();
    if (!theme) throw new JourneyTransitionError("An album theme is required.");

    const reference: PlaylistReference = {
      chatId: journey.moodChatId,
      taskId: song.id,
      title: song.title?.trim() || song.description.slice(0, 40),
      prompt: song.description,
      musicSpec: song.musicSpec,
    };
    const task = await this.#tasks.create({
      description: theme,
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "none",
      compositionMode: "album",
      workflowType: "05-playlist",
      lyriaModel: "lyria-3.5",
      ...(input.candidateCount === undefined ? {} : { candidateCount: input.candidateCount }),
      ...(input.targetTotalMinutes === undefined ? {} : { targetTotalMinutes: input.targetTotalMinutes }),
      playlistReferences: [reference],
      journeyId: journey.id,
      parentTaskId: song.id,
    }, config);

    const updated = await this.#apply(journey, { type: "continue-album", songTaskId: song.id }, {
      albumTaskId: task.id,
      songTaskId: song.id,
    });
    await this.#journeys.update(journey.id, { phase: updated.phase });
    return { journey: this.#journeys.get(journey.id)!, task, created: true };
  }

  /**
   * Approval is bound to one plan revision and persisted before generation may
   * start, so a second click cannot pay for a second album.
   */
  async approvePlan(
    identifier: string,
    revision?: number,
  ): Promise<{ journey: MusicJourney; task: MusicTask; approved: boolean }> {
    const journey = await this.sync(identifier);
    if (!journey.albumTaskId) throw new JourneyTransitionError("This journey has no album plan yet.");
    const album = this.#tasks.get(journey.albumTaskId);
    if (!album) throw new JourneyTransitionError("The album for this journey is unavailable.");
    if (journey.approvedPlanRevision !== undefined && album.playlistPlanApproved) {
      return { journey, task: album, approved: false };
    }
    if (journey.phase !== "album-review" || album.status !== "review") {
      throw new JourneyTransitionError("This album plan is not awaiting confirmation.");
    }
    if (!album.albumPlan || !album.playlistBriefing) {
      throw new JourneyTransitionError("This album has no plan to confirm yet.");
    }
    const currentRevision = album.albumPlanRevision ?? 1;
    if (revision !== undefined && revision !== currentRevision) {
      throw new JourneyTransitionError("The plan changed since you opened it. Review the latest revision.");
    }
    const queued = await this.#tasks.update(album.id, {
      status: "queued",
      playlistPlanApproved: true,
      error: undefined,
    });
    const next = await this.#apply(journey, { type: "plan-approved", revision: currentRevision });
    return { journey: this.#journeys.get(next.id)!, task: queued, approved: true };
  }

  /** Resume a failed journey from the stage that failed. */
  async retry(identifier: string): Promise<{ journey: MusicJourney; task: MusicTask }> {
    const journey = await this.sync(identifier);
    if (journey.phase !== "failed") {
      throw new JourneyTransitionError("This journey is not waiting to be continued.");
    }
    const album = journey.albumTaskId ? this.#tasks.get(journey.albumTaskId) : undefined;
    const song = journey.songTaskId ? this.#tasks.get(journey.songTaskId) : undefined;
    const resume: "song-running" | "album-planning" | "album-running" = !album
      ? "song-running"
      : journey.approvedPlanRevision ? "album-running" : "album-planning";
    const target = resume === "song-running" ? song : album;
    if (!target) throw new JourneyTransitionError("There is no work to continue.");
    if (ACTIVE_TASK_STATUSES.includes(target.status)) {
      throw new JourneyTransitionError("This journey is already running.");
    }
    const queued = await this.#tasks.update(target.id, { status: "queued", error: undefined });
    const next = await this.#apply(journey, { type: "retry", resume });
    return { journey: this.#journeys.get(next.id)!, task: queued };
  }
}
