import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
import { isMusicJourney, type MusicJourney } from "./types.js";

/**
 * Journeys are tiny JSON records in their own directory. They never hold audio,
 * conversations, or task copies — only the identifiers that link those records
 * and the current phase of the journey.
 */
export class JourneyStore {
  readonly #directory: string;
  readonly #journeys = new Map<string, MusicJourney>();

  constructor(directory: string) {
    this.#directory = path.resolve(directory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    for (const entry of await readdir(this.#directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const value: unknown = JSON.parse(await readFile(path.join(this.#directory, entry.name), "utf8"));
        if (isMusicJourney(value)) this.#journeys.set(value.id, value);
      } catch {
        // Preserve malformed records on disk without exposing them at runtime.
      }
    }
  }

  get(id: string): MusicJourney | undefined {
    return this.#journeys.get(id);
  }

  list(): MusicJourney[] {
    return [...this.#journeys.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  /** The journey a MoodMic conversation, song task, or album task belongs to. */
  find(identifier: string): MusicJourney | undefined {
    const direct = this.#journeys.get(identifier);
    if (direct) return direct;
    return this.list().find((journey) => journey.moodChatId === identifier
      || journey.songTaskId === identifier
      || journey.albumTaskId === identifier);
  }

  findByChatId(moodChatId: string): MusicJourney | undefined {
    return this.list().find((journey) => journey.moodChatId === moodChatId);
  }

  /** One journey per MoodMic conversation; repeated creation returns the same record. */
  async create(input: { moodChatId: string; moodEntryId?: string; songTaskId?: string }): Promise<MusicJourney> {
    const existing = this.findByChatId(input.moodChatId);
    if (existing) {
      return this.update(existing.id, {
        ...(input.songTaskId && !existing.songTaskId ? { songTaskId: input.songTaskId } : {}),
        ...(input.moodEntryId && !existing.moodEntryId ? { moodEntryId: input.moodEntryId } : {}),
      });
    }
    const now = new Date().toISOString();
    const journey: MusicJourney = {
      id: crypto.randomUUID(),
      moodChatId: input.moodChatId,
      phase: input.songTaskId ? "song-running" : "mood",
      ...(input.songTaskId ? { songTaskId: input.songTaskId } : {}),
      ...(input.moodEntryId ? { moodEntryId: input.moodEntryId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.#journeys.set(journey.id, journey);
    await this.save(journey);
    return journey;
  }

  async remove(id: string): Promise<boolean> {
    if (!this.#journeys.delete(id)) return false;
    await rm(path.join(this.#directory, `${id}.json`), { force: true });
    return true;
  }

  /** Deletes the journey that belongs to a MoodMic conversation, if one exists. */
  async removeForChat(moodChatId: string): Promise<string[]> {
    const removed: string[] = [];
    for (const journey of this.list()) {
      if (journey.moodChatId !== moodChatId) continue;
      if (await this.remove(journey.id)) removed.push(journey.id);
    }
    return removed;
  }

  async update(id: string, changes: Partial<MusicJourney>): Promise<MusicJourney> {
    const journey = this.#journeys.get(id);
    if (!journey) throw new Error("Journey not found.");
    const updated: MusicJourney = {
      ...journey,
      ...changes,
      id: journey.id,
      moodChatId: journey.moodChatId,
      updatedAt: new Date().toISOString(),
    };
    if (!isMusicJourney(updated)) throw new Error("Invalid journey record.");
    this.#journeys.set(id, updated);
    await this.save(updated);
    return updated;
  }

  private save(journey: MusicJourney): Promise<void> {
    return writeTextFileAtomic(
      path.join(this.#directory, `${journey.id}.json`),
      `${JSON.stringify(journey, null, 2)}\n`,
    );
  }
}
