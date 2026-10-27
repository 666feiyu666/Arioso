import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MoodEntryStorageError, MoodEntryStore } from "../src/web/mood-store.js";
import { withWebServer } from "./helpers/web-server.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-mood-protection-"));
  roots.push(root);
  return root;
}

const validEntry = {
  id: "9f0d3c3a-1111-4a2b-8c3d-1234567890ab",
  date: "2026-02-01",
  group: "sage",
  emotion: "calm",
  retrospective: false,
  taskIds: [],
  createdAt: "2026-02-01T08:00:00.000Z",
  updatedAt: "2026-02-01T08:00:00.000Z",
};

async function corruptStore(contents: string): Promise<{ store: MoodEntryStore; filePath: string }> {
  const filePath = path.join(await temporaryDirectory(), "entries.json");
  await writeFile(filePath, contents);
  const store = new MoodEntryStore(filePath);
  await store.initialize();
  return { store, filePath };
}

describe("mood entry file protection", () => {
  it("initializes a missing file as an empty, writable store", async () => {
    const store = new MoodEntryStore(path.join(await temporaryDirectory(), "nested", "entries.json"));
    await store.initialize();
    expect(store.list()).toEqual([]);
    expect(store.storageIssue).toBeUndefined();
    const entry = await store.create({ date: "2026-02-01", group: "sage", emotion: "calm" });
    expect(store.get(entry.id)).toBeDefined();
  });

  it("keeps malformed JSON bytes and blocks every mutation", async () => {
    const { store, filePath } = await corruptStore('[{"id": nope');
    const before = await readFile(filePath, "utf8");
    expect(store.storageIssue).toContain("not valid JSON");

    await expect(store.create({ date: "2026-02-02", group: "gold", emotion: "hopeful" }))
      .rejects.toBeInstanceOf(MoodEntryStorageError);
    await expect(store.update("anything", { emotion: "elated" }))
      .rejects.toBeInstanceOf(MoodEntryStorageError);
    await expect(store.remove("anything")).rejects.toBeInstanceOf(MoodEntryStorageError);
    await expect(store.save()).rejects.toBeInstanceOf(MoodEntryStorageError);

    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("keeps an unexpected top-level shape and blocks every mutation", async () => {
    const { store, filePath } = await corruptStore(JSON.stringify({ entries: [validEntry] }));
    const before = await readFile(filePath, "utf8");
    expect(store.storageIssue).toContain("does not contain a list");

    await expect(store.create({ date: "2026-02-02", group: "gold", emotion: "hopeful" }))
      .rejects.toBeInstanceOf(MoodEntryStorageError);
    await expect(store.remove(validEntry.id)).rejects.toBeInstanceOf(MoodEntryStorageError);

    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("does not discard invalid records next to valid ones", async () => {
    const { store, filePath } = await corruptStore(JSON.stringify([validEntry, { id: "broken" }]));
    const before = await readFile(filePath, "utf8");
    expect(store.storageIssue).toContain("1 of 2 records");
    // Valid entries stay readable even though the file cannot be written.
    expect(store.list().map((entry) => entry.id)).toEqual([validEntry.id]);

    await expect(store.update(validEntry.id, { emotion: "elated" }))
      .rejects.toBeInstanceOf(MoodEntryStorageError);
    await expect(store.remove(validEntry.id)).rejects.toBeInstanceOf(MoodEntryStorageError);

    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("reports a filesystem read failure instead of treating it as an empty store", async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, "entries.json");
    // A directory where the file belongs cannot be read as a file.
    await mkdir(filePath);
    const store = new MoodEntryStore(filePath);
    await expect(store.initialize()).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EPERM|EACCES/) });
    expect(store.storageIssue).toBeUndefined();
  });

  it("answers a blocked check-in with an actionable server error", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/mood-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-02-02", group: "gold", emotion: "hopeful" }),
      });
      expect(response.status).toBe(500);
      const body = await response.json() as { error: string };
      expect(body.error).toContain("entries.json");
      expect(body.error).toContain("not valid JSON");
      expect(body.error).toContain("left untouched");

      // Reading stays available so the interface can explain the situation.
      expect((await fetch(`${baseUrl}/api/mood-entries`)).status).toBe(200);
    }, {
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "moodmic");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "entries.json"), '{"broken": true');
      },
    });
  });
});
