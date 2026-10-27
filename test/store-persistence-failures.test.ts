import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deterministic storage failures: the stores persist through `writeTextFileAtomic`
// and delete through `rm`, so both are injected here instead of raced.
const control = vi.hoisted(() => ({
  failWrites: null as null | ((filePath: string) => boolean),
  failRemovals: null as null | ((target: string) => boolean),
}));

vi.mock("../src/utils/files.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/files.js")>();
  return {
    ...actual,
    writeTextFileAtomic: (filePath: string, content: string) => {
      if (control.failWrites?.(String(filePath))) {
        return Promise.reject(Object.assign(new Error("Injected EIO"), { code: "EIO" }));
      }
      return actual.writeTextFileAtomic(filePath, content);
    },
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rm: (target: Parameters<typeof actual.rm>[0], options?: Parameters<typeof actual.rm>[1]) => {
      if (control.failRemovals?.(String(target))) {
        return Promise.reject(Object.assign(new Error("Injected EIO"), { code: "EIO" }));
      }
      return actual.rm(target, options);
    },
  };
});

const { TaskStore } = await import("../src/web/task-store.js");
const { MoodEntryStore } = await import("../src/web/mood-store.js");
const { MoodChatStore } = await import("../src/web/mood-chat-store.js");
const { JourneyStore } = await import("../src/journey/journey-store.js");

const roots: string[] = [];

beforeEach(() => {
  control.failWrites = null;
  control.failRemovals = null;
});

afterEach(async () => {
  control.failWrites = null;
  control.failRemovals = null;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-store-write-test-"));
  roots.push(root);
  return root;
}

function failOn(fileName: string): (filePath: string) => boolean {
  return (filePath) => path.basename(filePath) === fileName;
}

async function savedTaskStore(root: string): Promise<{ store: InstanceType<typeof TaskStore>; recordPath: string; directory: string }> {
  const directory = path.join(root, "tasks");
  const taskDirectory = path.join(directory, "01-general", "saved-task");
  await mkdir(taskDirectory, { recursive: true });
  const recordPath = path.join(taskDirectory, "task.json");
  await writeFile(recordPath, JSON.stringify({
    id: "saved-task",
    description: "A quiet piece",
    title: "Quiet piece",
    mode: "compose",
    status: "completed",
    workflowType: "01-general",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));
  const store = new TaskStore(directory);
  await store.initialize({ markInterrupted: false });
  return { store, recordPath, directory };
}

describe("task store persistence boundaries", () => {
  it("does not publish an update whose record write failed", async () => {
    const root = await temporaryDirectory();
    const { store, recordPath, directory } = await savedTaskStore(root);
    const before = await readFile(recordPath, "utf8");

    control.failWrites = failOn("task.json");
    await expect(store.update("saved-task", { title: "Changed" })).rejects.toThrow("Injected EIO");

    expect(store.get("saved-task")?.title).toBe("Quiet piece");
    expect(await readFile(recordPath, "utf8")).toBe(before);

    control.failWrites = null;
    const reloaded = new TaskStore(directory);
    await reloaded.initialize({ markInterrupted: false });
    expect(reloaded.get("saved-task")?.title).toBe("Quiet piece");
  });

  it("leaves no phantom record after a failed create and stays usable", async () => {
    const root = await temporaryDirectory();
    const directory = path.join(root, "tasks");
    const store = new TaskStore(directory);
    await store.initialize({ markInterrupted: false });

    control.failWrites = () => true;
    await expect(store.create({
      description: "New piece",
      mode: "compose",
      vocalMode: "auto",
      corpusMode: "none",
      compositionMode: "single",
      workflowType: "01-general",
    }, { openAiModel: "composer", lyriaModel: "lyria-3.5" } as never)).rejects.toThrow("Injected EIO");
    expect(store.list()).toEqual([]);

    control.failWrites = null;
    const created = await store.create({
      description: "New piece",
      mode: "compose",
      vocalMode: "auto",
      corpusMode: "none",
      compositionMode: "single",
      workflowType: "01-general",
    }, { openAiModel: "composer", lyriaModel: "lyria-3.5" } as never);
    expect(store.list().map((task) => task.id)).toEqual([created.id]);
  });

  it("keeps a usable record when a delete fails, and retries cleanly", async () => {
    const root = await temporaryDirectory();
    const { store } = await savedTaskStore(root);

    control.failRemovals = () => true;
    await expect(store.delete("saved-task")).rejects.toThrow("Injected EIO");
    expect(store.get("saved-task")?.id).toBe("saved-task");

    control.failRemovals = null;
    expect(await store.delete("saved-task")).toBeDefined();
    expect(store.get("saved-task")).toBeUndefined();
  });

  it("keeps both changes when two updates of one task overlap", async () => {
    const root = await temporaryDirectory();
    const { store, recordPath } = await savedTaskStore(root);

    const [titled, errored] = await Promise.all([
      store.update("saved-task", { title: "Renamed" }),
      store.update("saved-task", { error: "Note" }),
    ]);
    expect(titled.title).toBe("Renamed");
    expect(errored.title).toBe("Renamed");
    expect(store.get("saved-task")?.error).toBe("Note");

    const reloaded = new TaskStore(path.dirname(recordPath));
    await reloaded.initialize({ markInterrupted: false });
    expect(reloaded.get("saved-task")).toMatchObject({ title: "Renamed", error: "Note" });
  });
});

describe("mood entry store persistence boundaries", () => {
  it("does not publish an update or create whose write failed", async () => {
    const root = await temporaryDirectory();
    const filePath = path.join(root, "entries.json");
    const store = new MoodEntryStore(filePath);
    await store.initialize();
    const entry = await store.create({ date: "2026-02-01", group: "sage", emotion: "calm" });
    const before = await readFile(filePath, "utf8");

    control.failWrites = failOn("entries.json");
    await expect(store.update(entry.id, { emotion: "elated" })).rejects.toThrow("Injected EIO");
    await expect(store.create({ date: "2026-02-02", group: "gold", emotion: "hopeful" }))
      .rejects.toThrow("Injected EIO");

    expect(store.list()).toHaveLength(1);
    expect(store.get(entry.id)?.emotion).toBe("calm");
    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("keeps the entry when a removal fails", async () => {
    const root = await temporaryDirectory();
    const store = new MoodEntryStore(path.join(root, "entries.json"));
    await store.initialize();
    const entry = await store.create({ date: "2026-02-01", group: "sage", emotion: "calm" });

    control.failWrites = failOn("entries.json");
    await expect(store.remove(entry.id)).rejects.toThrow("Injected EIO");
    expect(store.get(entry.id)).toBeDefined();

    control.failWrites = null;
    expect(await store.remove(entry.id)).toBe(true);
    expect(store.get(entry.id)).toBeUndefined();
  });
});

describe("conversation and journey persistence boundaries", () => {
  it("does not publish a chat message whose write failed", async () => {
    const root = await temporaryDirectory();
    const store = new MoodChatStore(path.join(root, "chats"));
    await store.initialize();
    const chat = await store.create();
    await store.addMessage(chat.id, "user", "Something calm");

    control.failWrites = failOn("session.json");
    await expect(store.addMessage(chat.id, "assistant", "Understood")).rejects.toThrow("Injected EIO");
    expect(store.get(chat.id)?.messages).toHaveLength(1);

    control.failWrites = null;
    expect((await store.addMessage(chat.id, "assistant", "Understood")).messages).toHaveLength(2);
  });

  it("keeps the chat record when a delete fails", async () => {
    const root = await temporaryDirectory();
    const store = new MoodChatStore(path.join(root, "chats"));
    await store.initialize();
    const chat = await store.create();

    control.failRemovals = () => true;
    await expect(store.delete(chat.id)).rejects.toThrow("Injected EIO");
    expect(store.get(chat.id)).toBeDefined();

    control.failRemovals = null;
    expect(await store.delete(chat.id)).toBe(true);
    expect(store.get(chat.id)).toBeUndefined();
  });

  it("does not publish a journey update whose write failed", async () => {
    const root = await temporaryDirectory();
    const store = new JourneyStore(path.join(root, "journeys"));
    await store.initialize();
    const journey = await store.create({ moodChatId: "mood-chat" });

    control.failWrites = failOn(`${journey.id}.json`);
    await expect(store.update(journey.id, { phase: "album-running" })).rejects.toThrow("Injected EIO");
    expect(store.get(journey.id)?.phase).toBe(journey.phase);

    control.failWrites = null;
    expect((await store.update(journey.id, { phase: "album-running" })).phase).toBe("album-running");
  });
});
