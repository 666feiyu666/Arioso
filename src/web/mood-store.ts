import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
import { KeyedQueue } from "../utils/queues.js";
import { isRecord } from "../utils/validation.js";

// MoodMic keeps its own record of how people feel. Each check-in belongs to one
// of four colour groups arranged by energy (higher above) and pleasantness
// (unpleasant left of pleasant). The stored colour is never overwritten by the
// feeling the user wants their music to carry.
export const MOOD_GROUPS = ["coral", "gold", "blue", "sage"] as const;
export type MoodGroup = (typeof MOOD_GROUPS)[number];

export interface MoodEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  group: MoodGroup;
  /** Emotion word chosen from the group. */
  emotion: string;
  note?: string | undefined;
  /** How the user wants the music to feel — kept separate from the mood. */
  musicFeeling?: string | undefined;
  /** True when the entry is recorded for a past day. */
  retrospective: boolean;
  /** MoodMic creations that started from this check-in. */
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MoodEntryInput {
  date: string;
  group: MoodGroup;
  emotion: string;
  note?: string | undefined;
  musicFeeling?: string | undefined;
  retrospective?: boolean | undefined;
}

export type MoodEntryPatch = Partial<Omit<MoodEntryInput, "date">> & { date?: string };

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/u.test(value);
}

function isMoodGroup(value: unknown): value is MoodGroup {
  return MOOD_GROUPS.includes(value as MoodGroup);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isMoodEntry(value: unknown): value is MoodEntry {
  return isRecord(value)
    && isSafeId(value.id)
    && isCalendarDate(value.date)
    && isMoodGroup(value.group)
    && typeof value.emotion === "string"
    && (value.note === undefined || typeof value.note === "string")
    && (value.musicFeeling === undefined || typeof value.musicFeeling === "string")
    && typeof value.retrospective === "boolean"
    && Array.isArray(value.taskIds)
    && value.taskIds.every((taskId: unknown) => typeof taskId === "string")
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

/**
 * Raised when the entry file exists but cannot be read as a mood-entry store.
 * The original bytes are left untouched, and writes stay blocked so a damaged
 * file is never replaced by whatever the runtime happened to load.
 */
export class MoodEntryStorageError extends Error {
  readonly code = "EMOODENTRYSTORE";

  constructor(readonly filePath: string, readonly reason: string) {
    super(
      `Mood entries could not be read from ${filePath}: ${reason}. `
      + "The file was left untouched and new check-ins are blocked until it is repaired or moved aside.",
    );
    this.name = "MoodEntryStorageError";
  }
}

export class MoodEntryStore {
  readonly #filePath: string;
  readonly #entries = new Map<string, MoodEntry>();
  /** The whole entry file is one resource: every mutation is serialized. */
  readonly #mutations = new KeyedQueue();
  /** Set when the stored bytes are not a fully usable entry file. */
  #storageIssue: string | undefined;

  constructor(filePath: string) {
    this.#filePath = path.resolve(filePath);
  }

  /** Why the store is read-only, if it is. Empty for a healthy store. */
  get storageIssue(): string | undefined {
    return this.#storageIssue;
  }

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    let raw: string;
    try {
      raw = await readFile(this.#filePath, "utf8");
    } catch (error) {
      // A missing file is simply an empty store; real filesystem failures remain
      // observable instead of looking like an empty store.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Preserve an unreadable file on disk rather than discarding user feelings.
      this.#storageIssue = "the file is not valid JSON";
      return;
    }
    if (!Array.isArray(parsed)) {
      this.#storageIssue = "the file does not contain a list of entries";
      return;
    }
    let invalid = 0;
    for (const value of parsed) {
      if (isMoodEntry(value)) this.#entries.set(value.id, value);
      else invalid += 1;
    }
    if (invalid > 0) {
      // Valid neighbours must not justify dropping the invalid records on save.
      this.#storageIssue = `${invalid} of ${parsed.length} records are not readable mood entries`;
    }
  }

  list(): MoodEntry[] {
    return [...this.#entries.values()].sort((left, right) => {
      const byDate = right.date.localeCompare(left.date);
      return byDate !== 0 ? byDate : right.createdAt.localeCompare(left.createdAt);
    });
  }

  get(id: string): MoodEntry | undefined {
    return this.#entries.get(id);
  }

  async create(input: MoodEntryInput): Promise<MoodEntry> {
    const now = new Date().toISOString();
    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      date: input.date,
      group: input.group,
      emotion: input.emotion,
      ...(input.note ? { note: input.note } : {}),
      ...(input.musicFeeling ? { musicFeeling: input.musicFeeling } : {}),
      retrospective: input.retrospective ?? false,
      taskIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.#mutate((current) => [...current, entry]);
    return entry;
  }

  async update(id: string, patch: MoodEntryPatch): Promise<MoodEntry | undefined> {
    let updated: MoodEntry | undefined;
    const result = await this.#mutate((current) => {
      if (!current.some((entry) => entry.id === id)) return current;
      return current.map((entry) => {
        if (entry.id !== id) return entry;
        const next: MoodEntry = {
          ...entry,
          ...(patch.date !== undefined ? { date: patch.date } : {}),
          ...(patch.group !== undefined ? { group: patch.group } : {}),
          ...(patch.emotion !== undefined ? { emotion: patch.emotion } : {}),
          note: patch.note !== undefined ? cleanText(patch.note) : entry.note,
          musicFeeling: patch.musicFeeling !== undefined
            ? cleanText(patch.musicFeeling)
            : entry.musicFeeling,
          ...(patch.retrospective !== undefined ? { retrospective: patch.retrospective } : {}),
          updatedAt: new Date().toISOString(),
        };
        if (next.note === undefined) delete next.note;
        if (next.musicFeeling === undefined) delete next.musicFeeling;
        updated = next;
        return next;
      });
    });
    return result.some((entry) => entry.id === id) ? updated : undefined;
  }

  async remove(id: string): Promise<boolean> {
    let removed = false;
    await this.#mutate((current) => {
      if (!current.some((entry) => entry.id === id)) return current;
      removed = true;
      return current.filter((entry) => entry.id !== id);
    });
    return removed;
  }

  /** Record that a MoodMic creation started from this check-in. */
  async linkTask(id: string, taskId: string): Promise<MoodEntry | undefined> {
    let linked: MoodEntry | undefined;
    const result = await this.#mutate((current) => {
      const existing = current.find((entry) => entry.id === id);
      if (!existing) return current;
      if (existing.taskIds.includes(taskId)) {
        linked = existing;
        return current;
      }
      linked = {
        ...existing,
        taskIds: [...existing.taskIds, taskId],
        updatedAt: new Date().toISOString(),
      };
      return current.map((entry) => entry.id === id ? linked! : entry);
    });
    return result.some((entry) => entry.id === id) ? linked : undefined;
  }

  /** Drops a deleted task from every check-in that referenced it. */
  async unlinkTask(taskId: string): Promise<void> {
    await this.#mutate((current) => current.some((entry) => entry.taskIds.includes(taskId))
      ? current.map((entry) => entry.taskIds.includes(taskId)
        ? {
          ...entry,
          taskIds: entry.taskIds.filter((candidate) => candidate !== taskId),
          updatedAt: new Date().toISOString(),
        }
        : entry)
      : current);
  }

  async save(): Promise<void> {
    this.#assertWritable();
    const serialized = `${JSON.stringify(this.list(), null, 2)}\n`;
    await writeTextFileAtomic(this.#filePath, serialized);
  }

  /**
   * The single mutation path for the entry file: derive the new list from the
   * current one, persist it, then publish it. A failed write leaves memory
   * untouched, so a rejected change never looks committed. Returning the current
   * list unchanged skips the write. `derive` must not re-enter this lock.
   */
  #mutate(derive: (current: MoodEntry[]) => MoodEntry[]): Promise<MoodEntry[]> {
    return this.#mutations.run("entries", async () => {
      this.#assertWritable();
      const current = this.list();
      const next = derive(current);
      if (next === current) return current;
      await writeTextFileAtomic(this.#filePath, serializeEntries(next));
      this.#entries.clear();
      for (const entry of next) this.#entries.set(entry.id, entry);
      return this.list();
    });
  }

  /** A damaged file stays read-only: repairing it is an explicit user action. */
  #assertWritable(): void {
    if (this.#storageIssue) {
      throw new MoodEntryStorageError(this.#filePath, this.#storageIssue);
    }
  }
}

function serializeEntries(entries: MoodEntry[]): string {
  const sorted = [...entries].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    return byDate !== 0 ? byDate : right.createdAt.localeCompare(left.createdAt);
  });
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

export { isMoodGroup };
