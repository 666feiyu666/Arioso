import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AriosoConfig } from "../src/config/env.js";
import { TaskStore, parseTaskInput } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

// A 1x1 PNG: enough to check the signature check and the byte round trip.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Starts a server with one finished album and hands its id to the test. */
async function withAlbum(
  test: (context: { baseUrl: string; albumId: string }) => Promise<void>,
): Promise<void> {
  let albumId = "";
  await withWebServer(async ({ baseUrl }) => {
    await test({ baseUrl, albumId });
  }, {
    prepare: async (root) => {
      const store = new TaskStore(path.join(root, "outputs", "tasks"));
      await store.initialize({ markInterrupted: false });
      const config = {
        openAiApiKey: "test-key",
        openAiModel: "test-model",
        geminiApiKey: undefined,
        geminiReviewModel: "test-review-model",
        lyriaModel: "test-lyria-model",
        outputDirectory: path.join(root, "outputs"),
      } satisfies AriosoConfig;
      const task = await store.create(parseTaskInput({
        description: "A cover test album",
        workflowType: "05-playlist",
        candidateCount: 12,
        targetTotalMinutes: 30,
      }), config);
      albumId = task.id;
    },
  });
}

describe("album cover", () => {
  it("stores, serves, and removes a user-picked cover", async () => {
    await withAlbum(async ({ baseUrl, albumId }) => {
      expect((await fetch(`${baseUrl}/api/tasks/${albumId}/cover`)).status).toBe(404);

      const uploaded = await fetch(`${baseUrl}/api/tasks/${albumId}/cover`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: PNG,
      });
      expect(uploaded.status).toBe(200);
      const task = await uploaded.json() as { coverUpdatedAt?: string };
      expect(task.coverUpdatedAt).toBeTruthy();

      const served = await fetch(`${baseUrl}/api/tasks/${albumId}/cover`);
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toContain("image/png");
      expect(Buffer.from(await served.arrayBuffer()).equals(PNG)).toBe(true);

      const removed = await fetch(`${baseUrl}/api/tasks/${albumId}/cover`, { method: "DELETE" });
      expect(removed.status).toBe(200);
      expect((await removed.json() as { coverUpdatedAt?: string }).coverUpdatedAt).toBeUndefined();

      expect((await fetch(`${baseUrl}/api/tasks/${albumId}/cover`)).status).toBe(404);
    });
  });

  it("rejects an upload that is not a PNG", async () => {
    await withAlbum(async ({ baseUrl, albumId }) => {
      const response = await fetch(`${baseUrl}/api/tasks/${albumId}/cover`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: Buffer.from("not an image"),
      });
      expect(response.status).toBe(415);
    });
  });
});
