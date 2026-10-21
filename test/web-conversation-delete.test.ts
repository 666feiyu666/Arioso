import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const composeMock = vi.hoisted(() => vi.fn(async () => ({
  schemaVersion: "1.0",
  title: "Quiet Evening",
  intent: "A quiet evening.",
  genres: ["jazz"],
  moods: ["quiet"],
  tempo: { bpm: null, feel: "relaxed" },
  tonality: { tonic: null, mode: null },
  meter: null,
  instrumentation: [],
  structure: [],
  vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
  production: "Natural dynamics.",
  avoid: ["vocals"],
  assumptions: [],
  lyriaPrompt: "Quiet music, instrumental only, no vocals.",
})));

vi.mock("../src/composer/composer-agent.js", () => ({ composeMusic: composeMock }));

import { TaskStore } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const stubAgent = {
  respond: async () => ({ content: "A quiet direction.", mood: { label: "calm", imagery: "dusk" } }),
  propose: async () => "Compose a quiet piano piece.",
};

async function json<T = Record<string, any>>(response: Response): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return await response.json() as T;
}

async function waitForTask(baseUrl: string, taskId: string): Promise<void> {
  await vi.waitFor(async () => {
    const task = await fetch(`${baseUrl}/api/tasks/${taskId}`).then((response) => json(response));
    expect(["completed", "failed"]).toContain(task.status);
  });
}

describe("conversation deletion", () => {
  it("deletes a MoodMic conversation with its task, audio directory, journey and feeling link", async () => {
    await withWebServer(async ({ baseUrl, root }) => {
      const chat = await fetch(`${baseUrl}/api/mood-chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicReference: "jazz" }),
      }).then((response) => json(response));
      await fetch(`${baseUrl}/api/mood-chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Something for the evening", attachmentIds: [] }),
      });

      const entry = await fetch(`${baseUrl}/api/mood-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-10-21", group: "blue", emotion: "lonely", note: "quiet" }),
      }).then((response) => json(response));

      const submitted = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "A quiet piano piece.", mode: "compose" }),
      }).then((response) => json(response));
      const taskId = submitted.task.id as string;
      await waitForTask(baseUrl, taskId);

      await fetch(`${baseUrl}/api/mood-entries/${entry.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      const taskDirectory = path.join(root, "outputs", "tasks", "02-music", taskId);
      const chatDirectory = path.join(root, "outputs", "moodmic", "chats", chat.id);
      expect((await stat(taskDirectory)).isDirectory()).toBe(true);
      expect((await stat(chatDirectory)).isDirectory()).toBe(true);
      const journeyBefore = await fetch(`${baseUrl}/api/journeys/${chat.id}`);
      expect(journeyBefore.status).toBe(200);

      const response = await fetch(`${baseUrl}/api/mood-chats/${chat.id}`, { method: "DELETE" });
      expect(response.status).toBe(200);
      expect(await json(response)).toMatchObject({ deleted: { conversationId: chat.id, taskIds: [taskId] } });

      await expect(stat(taskDirectory)).rejects.toThrow();
      await expect(stat(chatDirectory)).rejects.toThrow();
      expect(await fetch(`${baseUrl}/api/mood-chats/${chat.id}`).then((r) => r.status)).toBe(404);
      expect(await fetch(`${baseUrl}/api/mood-chats`).then((r) => json(r))).toEqual([]);
      expect(await fetch(`${baseUrl}/api/tasks/${taskId}`).then((r) => r.status)).toBe(404);
      expect(await fetch(`${baseUrl}/api/journeys/${chat.id}`).then((r) => r.status)).toBe(404);
      const entries = await fetch(`${baseUrl}/api/mood-entries`).then((r) => json(r));
      expect(entries.entries[0].taskIds).toEqual([]);
    }, { discussionAgent: stubAgent, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("deletes a workflow discussion with the task it produced", async () => {
    await withWebServer(async ({ baseUrl, root }) => {
      const session = await fetch(`${baseUrl}/api/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compositionMode: "single", workflowType: "01-general" }),
      }).then((response) => json(response));
      await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "A quiet evening", attachmentIds: [] }),
      });
      const proposal = await fetch(`${baseUrl}/api/discussions/${session.id}/proposal`, { method: "POST" })
        .then((response) => json(response));
      const submitted = await fetch(`${baseUrl}/api/discussions/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: proposal.proposal, mode: "compose" }),
      }).then((response) => json(response));
      const taskId = submitted.task.id as string;
      await waitForTask(baseUrl, taskId);

      const taskDirectory = path.join(root, "outputs", "tasks", "01-general", taskId);
      expect((await stat(taskDirectory)).isDirectory()).toBe(true);

      const response = await fetch(`${baseUrl}/api/discussions/${session.id}`, { method: "DELETE" });
      expect(response.status).toBe(200);
      expect(await json(response)).toMatchObject({ deleted: { sessionId: session.id, taskIds: [taskId] } });

      await expect(stat(taskDirectory)).rejects.toThrow();
      expect(await fetch(`${baseUrl}/api/discussions`).then((r) => json(r))).toEqual([]);
      expect(await fetch(`${baseUrl}/api/tasks/${taskId}`).then((r) => r.status)).toBe(404);
    }, { discussionAgent: stubAgent, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("reports a missing conversation instead of deleting anything", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const missing = "11111111-1111-4111-8111-111111111111";
      expect(await fetch(`${baseUrl}/api/mood-chats/${missing}`, { method: "DELETE" }).then((r) => r.status)).toBe(404);
      expect(await fetch(`${baseUrl}/api/discussions/${missing}`, { method: "DELETE" }).then((r) => r.status)).toBe(404);
    });
  });

  it("refuses to delete a task that is still running", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "arioso-delete-task-"));
    const directory = path.join(root, "tasks", "01-general", "22222222-2222-4222-8222-222222222222");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "task.json"), JSON.stringify({
      id: "22222222-2222-4222-8222-222222222222",
      description: "still running",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "none",
      compositionMode: "single",
      workflowType: "01-general",
      status: "generating",
      composerModel: "test",
      lyriaModel: "test",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }), "utf8");

    const store = new TaskStore(path.join(root, "tasks"));
    await store.initialize({ markInterrupted: false });
    await expect(store.delete("22222222-2222-4222-8222-222222222222")).rejects.toThrow(/still running/u);
    expect((await stat(directory)).isDirectory()).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
});
