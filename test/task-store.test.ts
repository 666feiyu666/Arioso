import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TaskStore, organizeTaskStorage } from "../src/web/task-store.js";
import { writeTextFileAtomic } from "../src/utils/files.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-store-test-"));
  roots.push(root);
  return root;
}

function savedTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "saved-task", description: "A quiet piece", title: "Quiet piece",
    mode: "compose", status: "completed", workflowType: "01-general",
    updatedAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

async function writeTask(directory: string, task: ReturnType<typeof savedTask>): Promise<string> {
  const taskDirectory = path.join(directory, "01-general", task.id);
  await mkdir(taskDirectory, { recursive: true });
  const recordPath = path.join(taskDirectory, "task.json");
  await writeFile(recordPath, JSON.stringify(task));
  return recordPath;
}

describe("task persistence boundaries", () => {
  it("skips malformed records without modifying them or losing valid records", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    await mkdir(directory);
    const malformed = ["null", "[]", "{", JSON.stringify(savedTask({ id: ".." })),
      JSON.stringify(savedTask({ id: 42 })), JSON.stringify(savedTask({ movements: {} }))];
    for (const [index, value] of malformed.entries()) {
      await writeFile(path.join(directory, `invalid-${index}.json`), value);
    }
    await writeTask(directory, savedTask());
    const store = new TaskStore(directory);
    await store.initialize();
    expect(store.list().map((task) => task.id)).toEqual(["saved-task"]);
    for (const [index, value] of malformed.entries()) {
      expect(await readFile(path.join(directory, `invalid-${index}.json`), "utf8")).toBe(value);
    }
  });

  it("leaves task and movement statuses untouched during offline assembly inspection", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    const recordPath = await writeTask(directory, savedTask({ status: "generating", movements: [
      { id: "m1", order: 1, title: "Opening", status: "generating" },
    ] }));
    const original = await readFile(recordPath, "utf8");
    const store = new TaskStore(directory);
    await store.initialize({ markInterrupted: false });
    expect(store.get("saved-task")?.status).toBe("generating");
    expect(store.get("saved-task")?.movements?.[0]?.status).toBe("generating");
    expect(await readFile(recordPath, "utf8")).toBe(original);
  });

  it("marks interrupted work failed while preserving completed movements", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    const recordPath = await writeTask(directory, savedTask({ status: "generating", movements: [
      { id: "m1", order: 1, title: "Opening", status: "completed" },
      { id: "m2", order: 2, title: "Ending", status: "generating" },
    ] }));
    const store = new TaskStore(directory);
    await store.initialize();
    expect(store.get("saved-task")?.status).toBe("failed");
    expect(store.get("saved-task")?.movements?.map((movement) => movement.status))
      .toEqual(["completed", "failed"]);
    expect(JSON.parse(await readFile(recordPath, "utf8")).status).toBe("failed");
  });

  it("persists the newest snapshot after overlapping task updates", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    const recordPath = await writeTask(directory, savedTask());
    const store = new TaskStore(directory);
    await store.initialize();
    await Promise.all(Array.from({ length: 12 }, (_, index) =>
      store.update("saved-task", { title: `Revision ${index}` }),
    ));
    expect(JSON.parse(await readFile(recordPath, "utf8")).title).toBe("Revision 11");
    expect(store.get("saved-task")?.title).toBe("Revision 11");
    expect(await readdir(path.dirname(recordPath))).toEqual(["task.json"]);
  });

  it("backs up a shared legacy audio source only once", async () => {
    const root = await temporaryDirectory();
    const directory = path.join(root, "tasks");
    await mkdir(directory);
    await writeFile(path.join(directory, "saved-task.json"), JSON.stringify(savedTask({
      workflowType: "03-orchestral", audioFile: "shared.mp3", movements: [
        { id: "m1", order: 1, title: "Opening", status: "completed", audioFile: "shared.mp3" },
      ],
    })));
    await writeFile(path.join(directory, "shared.mp3"), Buffer.from([1, 2, 3]));
    expect(await organizeTaskStorage(directory)).toEqual({ migratedTasks: 1, migratedAudioFiles: 2 });
    expect((await stat(path.join(root, "tasks-legacy-backup", "saved-task", "shared.mp3"))).size).toBe(3);
    expect(await organizeTaskStorage(directory)).toEqual({ migratedTasks: 0, migratedAudioFiles: 0 });
  });

  it("preserves conflicting legacy records and loads the current destination", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    const recordPath = await writeTask(directory, savedTask({ title: "Current version" }));
    const legacyPath = path.join(directory, "saved-task.json");
    const legacy = JSON.stringify(savedTask({ title: "Legacy version" }));
    await writeFile(legacyPath, legacy);
    expect(await organizeTaskStorage(directory)).toEqual({ migratedTasks: 0, migratedAudioFiles: 0 });
    expect(await readFile(legacyPath, "utf8")).toBe(legacy);
    expect(JSON.parse(await readFile(recordPath, "utf8")).title).toBe("Current version");
    const store = new TaskStore(directory);
    await store.initialize();
    expect(store.get("saved-task")?.title).toBe("Current version");
  });

  it("creates usable filenames for Windows device names", async () => {
    const directory = path.join(await temporaryDirectory(), "tasks");
    await writeTask(directory, savedTask({ title: "CON" }));
    const store = new TaskStore(directory);
    await store.initialize();
    const task = store.get("saved-task")!;
    const name = await store.writeAudio(task, Buffer.from([1]));
    expect(name).toBe("_CON.mp3");
    expect((await stat(path.join(directory, "01-general", task.id, name))).size).toBe(1);
  });
});

describe("atomic text writes", () => {
  it("allows another write after a failed replacement", async () => {
    const root = await temporaryDirectory();
    const destination = path.join(root, "record.json");
    await mkdir(destination);
    await expect(writeTextFileAtomic(destination, "first")).rejects.toThrow();
    await rm(destination, { recursive: true });
    await writeTextFileAtomic(destination, "second");
    expect(await readFile(destination, "utf8")).toBe("second");
    expect(await readdir(root)).toEqual(["record.json"]);
  });
});
