import { mkdir, writeFile } from "node:fs/promises";
import { request } from "node:http";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));
beforeEach(() => {
  generateMock.mockReset();
});

async function prepareTask(root: string, overrides: Record<string, unknown> = {}): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "01-general", "saved-task");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    id: "saved-task", description: "A quiet piece", title: "Quiet piece",
    mode: "generate", status: "completed", workflowType: "01-general",
    updatedAt: "2026-01-01T00:00:00.000Z", audioFile: "piece.mp3",
    composerModel: "test", lyriaModel: "lyria-3.5", ...overrides,
  }));
  await writeFile(path.join(directory, "piece.mp3"), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
}

describe("HTTP boundaries", () => {
  it("returns JSON errors for malformed and oversized bodies without dropping the connection", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const malformed = await fetch(`${baseUrl}/api/tasks`, { method: "POST", body: "{" });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toEqual({ error: "Request body must be valid JSON." });

      const oversized = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST", body: "x".repeat(64 * 1024 + 1),
      });
      expect(oversized.status).toBe(413);
      expect(await oversized.json()).toEqual({ error: "Request body is too large." });
      expect((await fetch(`${baseUrl}/api/tasks`)).status).toBe(200);
    });
  });

  it("validates a settings request completely before applying any fields", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const invalid = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT", body: JSON.stringify({
          language: "en", credentials: { openai: "test-session", gemini: null },
        }),
      });
      expect(invalid.status).toBe(400);
      const settings = await fetch(`${baseUrl}/api/settings`).then((response) => response.json());
      expect(settings).toMatchObject({ language: "zh-CN", credentials: { openai: { configured: false } } });

      const array = await fetch(`${baseUrl}/api/settings`, { method: "PUT", body: "[]" });
      expect(array.status).toBe(400);
    });
  });

  it("supports static HEAD responses with the same length as GET", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const get = await fetch(baseUrl);
      const content = await get.arrayBuffer();
      const head = await fetch(baseUrl, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(Number(head.headers.get("content-length"))).toBe(content.byteLength);
      expect(await head.text()).toBe("");
    });
  });

  it("handles invalid request targets as client errors", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const client = request(baseUrl, { path: "http://[" }, (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        client.on("error", reject);
        client.end();
      });
      expect(status).toBe(400);
      expect((await fetch(`${baseUrl}/api/tasks`)).status).toBe(200);
    });
  });
});

describe("saved audio delivery", () => {
  it("streams full, bounded and suffix ranges and supports HEAD", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const url = `${baseUrl}/api/tasks/saved-task/audio`;
      const full = await fetch(url);
      expect(full.status).toBe(200);
      expect(Buffer.from(await full.arrayBuffer())).toEqual(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
      const bounded = await fetch(url, { headers: { Range: "bytes=2-5" } });
      expect(bounded.status).toBe(206);
      expect(bounded.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(Buffer.from(await bounded.arrayBuffer())).toEqual(Buffer.from([2, 3, 4, 5]));
      const suffix = await fetch(url, { headers: { Range: "bytes=-3" } });
      expect(Buffer.from(await suffix.arrayBuffer())).toEqual(Buffer.from([7, 8, 9]));
      const head = await fetch(url, { method: "HEAD" });
      expect(head.headers.get("content-length")).toBe("10");
      expect(await head.text()).toBe("");
    }, { prepare: prepareTask });
  });

  it("returns 416 for invalid ranges", async () => {
    await withWebServer(async ({ baseUrl }) => {
      for (const range of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=0-1,3-4"]) {
        const response = await fetch(`${baseUrl}/api/tasks/saved-task/audio`, { headers: { Range: range } });
        expect(response.status).toBe(416);
        expect(response.headers.get("content-range")).toBe("bytes */10");
      }
    }, { prepare: prepareTask });
  });

  it.each(["missing.mp3", "../settings.json"])("returns 404 for unavailable audio: %s", async (audioFile) => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/saved-task/audio`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Audio is not available." });
    }, { prepare: (root) => prepareTask(root, { audioFile }) });
  });
});

describe("task retry", () => {
  it("starts one generation for overlapping retry requests", async () => {
    let finishGeneration: (() => void) | undefined;
    generateMock.mockImplementation(() => new Promise((resolve) => {
      finishGeneration = () => resolve({ audio: Buffer.from([1, 2, 3]), generatedText: null });
    }));
    await withWebServer(async ({ baseUrl }) => {
      const retries = await Promise.all([
        fetch(`${baseUrl}/api/tasks/saved-task/retry`, { method: "POST" }),
        fetch(`${baseUrl}/api/tasks/saved-task/retry`, { method: "POST" }),
      ]);
      expect(retries.map((response) => response.status).sort()).toEqual([202, 409]);
      await Promise.all(retries.map((response) => response.json()));
      await vi.waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
      expect(generateMock).toHaveBeenCalledWith("saved prompt", { model: "lyria-3.5" });
      finishGeneration!();
      await vi.waitFor(async () => {
        const task = await fetch(`${baseUrl}/api/tasks/saved-task`).then((response) => response.json());
        expect(task).toMatchObject({ status: "completed" });
      });
    }, {
      environment: { OPENAI_API_KEY: "test-local-only", GEMINI_API_KEY: "test-local-only" },
      prepare: (root) => prepareTask(root, { status: "failed", musicSpec: { lyriaPrompt: "saved prompt" } }),
    });
  });
});
