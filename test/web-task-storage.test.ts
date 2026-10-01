import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { inferWorkflowType, organizeTaskStorage } from "../src/web/server.js";

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
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-task-storage-"));
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
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-task-storage-"));
    await organizeTaskStorage(directory);

    for (const workflow of ["01-general", "02-jazz", "03-orchestral", "04-album"]) {
      expect((await stat(path.join(directory, workflow))).isDirectory()).toBe(true);
    }
  });
});
