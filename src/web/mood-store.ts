import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
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

export class MoodEntryStore {
  readonly #filePath: string;
  readonly #entries = new Map<string, MoodEntry>();

  constructor(filePath: string) {
    this.#filePath = path.resolve(filePath);
  }

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    let raw: string;
    try {
      raw = await readFile(this.#filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Preserve an unreadable file on disk rather than discarding user feelings.
      return;
    }
    if (!Array.isArray(parsed)) return;
    for (const value of parsed) {
      if (isMoodEntry(value)) this.#entries.set(value.id, value);
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
    this.#entries.set(entry.id, entry);
    await this.save();
    return entry;
  }

  async update(id: string, patch: MoodEntryPatch): Promise<MoodEntry | undefined> {
    const current = this.#entries.get(id);
    if (!current) return undefined;
    const next: MoodEntry = {
      ...current,
      ...(patch.date !== undefined ? { date: patch.date } : {}),
      ...(patch.group !== undefined ? { group: patch.group } : {}),
      ...(patch.emotion !== undefined ? { emotion: patch.emotion } : {}),
      note: patch.note !== undefined ? cleanText(patch.note) : current.note,
      musicFeeling: patch.musicFeeling !== undefined
        ? cleanText(patch.musicFeeling)
        : current.musicFeeling,
      ...(patch.retrospective !== undefined ? { retrospective: patch.retrospective } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (next.note === undefined) delete next.note;
    if (next.musicFeeling === undefined) delete next.musicFeeling;
    this.#entries.set(id, next);
    await this.save();
    return next;
  }

  async remove(id: string): Promise<boolean> {
    if (!this.#entries.delete(id)) return false;
    await this.save();
    return true;
  }

  /** Record that a MoodMic creation started from this check-in. */
  async linkTask(id: string, taskId: string): Promise<MoodEntry | undefined> {
    const current = this.#entries.get(id);
    if (!current) return undefined;
    if (current.taskIds.includes(taskId)) return current;
    const next: MoodEntry = {
      ...current,
      taskIds: [...current.taskIds, taskId],
      updatedAt: new Date().toISOString(),
    };
    this.#entries.set(id, next);
    await this.save();
    return next;
  }

  save(): Promise<void> {
    const serialized = `${JSON.stringify(this.list(), null, 2)}\n`;
    return writeTextFileAtomic(this.#filePath, serialized);
  }
}

export { isMoodGroup };
