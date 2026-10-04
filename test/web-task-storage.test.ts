import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";
import { inferWorkflowType, organizeTaskStorage } from "../src/web/task-store.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryTaskDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "arioso-task-storage-"));
  roots.push(root);
  const directory = path.join(root, "tasks");
  await mkdir(directory);
  return directory;
}

describe("task storage organization", () => {
  it("recognizes legacy multi-movement descriptions without workflow metadata", () => {
    expect(inferWorkflowType({
      description: "创作一部约十一分钟的原创四乐章交响曲",
    })).toBe("03-orchestral");
    expect(inferWorkflowType({
      description: "Create an original four-movement symphony.",
    })).toBe("03-orchestral");
  });

  it("migrates a flat task and audio into its workflow directory", async () => {
    const directory = await temporaryTaskDirectory();
    const id = "11111111-1111-4111-8111-111111111111";
    const task = {
      id,
      title: "Night: Journey?",
      description: "A nocturnal jazz piece",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "jazz",
      compositionMode: "single",
      status: "completed",
      composerModel: "test",
      lyriaModel: "test",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      audioFile: `${id}.mp3`,
    };
    await writeFile(path.join(directory, `${id}.json`), JSON.stringify(task), "utf8");
    await writeFile(path.join(directory, `${id}.mp3`), new Uint8Array([1, 2, 3]));

    const result = await organizeTaskStorage(directory);
    const taskDirectory = path.join(directory, "02-jazz", id);
    const migrated = JSON.parse(
      await readFile(path.join(taskDirectory, "task.json"), "utf8"),
    ) as { workflowType: string; audioFile: string };

    expect(result).toEqual({ migratedTasks: 1, migratedAudioFiles: 1 });
    expect(migrated.workflowType).toBe("02-jazz");
    expect(migrated.audioFile).toBe("Night Journey.mp3");
    expect((await stat(path.join(taskDirectory, migrated.audioFile))).size).toBe(3);
    await expect(stat(path.join(directory, `${id}.json`))).rejects.toThrow();
    await expect(stat(path.join(directory, `${id}.mp3`))).rejects.toThrow();
    expect((await stat(path.join(
      path.dirname(directory),
      `${path.basename(directory)}-legacy-backup`,
      id,
      `${id}.json`,
    ))).isFile()).toBe(true);
  });

  it("creates all workflow roots even when there are no tasks", async () => {
    const directory = await temporaryTaskDirectory();
    await organizeTaskStorage(directory);

    for (const workflow of ["01-general", "02-jazz", "03-orchestral", "04-album"]) {
      expect((await stat(path.join(directory, workflow))).isDirectory()).toBe(true);
    }
  });

  it("preserves a no-corpus Jazz task through migration and server reload", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    await withWebServer(async ({ baseUrl }) => {
      const tasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json());
      expect(tasks).toEqual([expect.objectContaining({ id, workflowType: "02-jazz", corpusMode: "none" })]);
    }, {
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "tasks");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, `${id}.json`), JSON.stringify({
          id,
          workflowType: "02-jazz",
          compositionMode: "single",
          corpusMode: "none",
          status: "completed",
          description: 'Create instrumental jazz inspired by "So What".',
          updatedAt: "2026-01-01T00:00:00.000Z",
        }));
        await organizeTaskStorage(directory);
        const stored = JSON.parse(await readFile(path.join(directory, "02-jazz", id, "task.json"), "utf8"));
        expect(stored).toMatchObject({ workflowType: "02-jazz", corpusMode: "none" });
      },
    });
  });
});
