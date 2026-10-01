import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assembleCompletedOrchestralTasks } from "../src/web/server.js";

function testMp3(frameCount: number): Buffer {
  const tag = Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]);
  const frames = Array.from({ length: frameCount }, () => {
    const frame = Buffer.alloc(626);
    Buffer.from([0xff, 0xfb, 0xb0, 0x44]).copy(frame);
    return frame;
  });
  return Buffer.concat([tag, ...frames]);
}

describe("completed orchestral task assembly", () => {
  it("backfills one reusable parent audio artifact without changing movement files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "arioso-orchestral-assembly-"));
    const id = "11111111-1111-4111-8111-111111111111";
    const taskDirectory = path.join(root, "03-orchestral", id);
    const movementDirectory = path.join(taskDirectory, "movements");
    await mkdir(movementDirectory, { recursive: true });
    await writeFile(path.join(movementDirectory, "01.mp3"), testMp3(2));
    await writeFile(path.join(movementDirectory, "02.mp3"), testMp3(3));
    await writeFile(path.join(taskDirectory, "task.json"), JSON.stringify({
      id,
      title: "Compact Symphony",
      description: "A compact two-movement symphony",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "none",
      compositionMode: "orchestral",
      workflowType: "03-orchestral",
      status: "completed",
      composerModel: "test",
      lyriaModel: "test",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      movements: [
        { id: "m1", order: 1, title: "First", status: "completed", audioFile: "01.mp3", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "m2", order: 2, title: "Second", status: "completed", audioFile: "02.mp3", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    }), "utf8");

    const result = await assembleCompletedOrchestralTasks(root);
    const task = JSON.parse(await readFile(path.join(taskDirectory, "task.json"), "utf8")) as {
      audioFile: string;
      orchestralAssembly: { durationSeconds: number; segmentDurationsSeconds: number[] };
    };

    expect(result).toEqual({ assembledTasks: 1, skippedTasks: 0, failures: [] });
    expect(task.audioFile).toBe("Compact Symphony.mp3");
    expect(task.orchestralAssembly.segmentDurationsSeconds).toHaveLength(2);
    expect((await stat(path.join(taskDirectory, task.audioFile))).size).toBe(5 * 626);
    expect((await stat(path.join(movementDirectory, "01.mp3"))).size).toBe(10 + 2 * 626);

    const secondRun = await assembleCompletedOrchestralTasks(root);
    expect(secondRun).toEqual({ assembledTasks: 0, skippedTasks: 1, failures: [] });
  });
});
