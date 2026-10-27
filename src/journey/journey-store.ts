import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
import { KeyedQueue } from "../utils/queues.js";
import { isMusicJourney, type MusicJourney } from "./types.js";

/**
 * Journeys are tiny JSON records in their own directory. They never hold audio,
 * conversations, or task copies — only the identifiers that link those records
 * and the current phase of the journey.
 */
export class JourneyStore {
  readonly #directory: string;
  readonly #journeys = new Map<string, MusicJourney>();
  /** One mutation at a time per journey: read, derive, persist, publish. */
  readonly #mutations = new KeyedQueue();

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
    // Serialize per conversation so two concurrent starts cannot open two journeys.
    return this.#mutations.run(`chat:${input.moodChatId}`, async () => {
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
      await this.save(journey);
      this.#journeys.set(journey.id, journey);
      return journey;
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.#mutations.run(id, async () => {
      if (!this.#journeys.has(id)) return false;
      // Remove the record from disk first: a failed delete keeps it retryable.
      await rm(path.join(this.#directory, `${id}.json`), { force: true });
      this.#journeys.delete(id);
      return true;
    });
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
    return this.#mutations.run(id, async () => {
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
      await this.save(updated);
      this.#journeys.set(id, updated);
      return updated;
    });
  }

  private save(journey: MusicJourney): Promise<void> {
    return writeTextFileAtomic(
      path.join(this.#directory, `${journey.id}.json`),
      `${JSON.stringify(journey, null, 2)}\n`,
    );
  }
}
