import { describe, expect, it } from "vitest";

import { MoodEntryStore, isCalendarDate } from "../src/web/mood-store.js";
import { withWebServer } from "./helpers/web-server.js";

async function createEntry(baseUrl: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}/api/mood-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2024-05-04",
      group: "sage",
      emotion: "calm",
      ...body,
    }),
  });
  return { response, body: (await response.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("mood entry store", () => {
  it("persists entries and reloads them sorted by date", async () => {
    const directory = await import("node:fs/promises").then((fs) =>
      fs.mkdtemp(`${process.env.TEMP ?? "/tmp"}/arioso-mood-`));
    const filePath = `${directory}/entries.json`;
    const store = new MoodEntryStore(filePath);
    await store.initialize();
    await store.create({ date: "2024-01-02", group: "blue", emotion: "sad", retrospective: true });
    await store.create({ date: "2024-03-01", group: "coral", emotion: "anxious" });

    const reloaded = new MoodEntryStore(filePath);
    await reloaded.initialize();
    expect(reloaded.list().map((entry) => entry.date)).toEqual(["2024-03-01", "2024-01-02"]);
    expect(reloaded.list()[1]?.retrospective).toBe(true);
    const { rm } = await import("node:fs/promises");
    await rm(directory, { recursive: true, force: true });
  });

  it("recognises only real calendar dates", async () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2023-02-29")).toBe(false);
    expect(isCalendarDate("2024-13-01")).toBe(false);
    expect(isCalendarDate("2024-1-1")).toBe(false);
    expect(isCalendarDate("not-a-date")).toBe(false);
  });
});

describe("web mood entries API", () => {
  it("creates, lists, edits and deletes a feeling", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { response, body } = await createEntry(baseUrl, {
        note: "quiet evening",
        musicFeeling: "nocturnal",
      });
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        date: "2024-05-04",
        group: "sage",
        emotion: "calm",
        note: "quiet evening",
        musicFeeling: "nocturnal",
        retrospective: false,
        taskIds: [],
      });

      const listed = await fetch(`${baseUrl}/api/mood-entries`).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(listed.entries).toHaveLength(1);
      expect(listed.entries[0].tasks).toEqual([]);

      const patched = await fetch(`${baseUrl}/api/mood-entries/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: "coral", emotion: "frustrated", note: "changed" }),
      }).then((r) => r.json());
      expect(patched).toMatchObject({ group: "coral", emotion: "frustrated", note: "changed" });

      const removed = await fetch(`${baseUrl}/api/mood-entries/${body.id}`, { method: "DELETE" });
      expect(removed.ok).toBe(true);
      expect((await fetch(`${baseUrl}/api/mood-entries`).then((r) => r.json()) as Record<string, any>).entries).toHaveLength(0); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  });

  it("validates the feeling, its date and its group", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const badDate = await createEntry(baseUrl, { date: "2024-13-40" });
      expect(badDate.response.status).toBe(400);
      const badGroup = await createEntry(baseUrl, { group: "purple" });
      expect(badGroup.response.status).toBe(400);
      const noEmotion = await createEntry(baseUrl, { emotion: "  " });
      expect(noEmotion.response.status).toBe(400);
    });
  });

  it("links a MoodMic creation to the feeling it came from", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { body } = await createEntry(baseUrl);
      const linked = await fetch(`${baseUrl}/api/mood-entries/${body.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "does-not-exist" }),
      });
      expect(linked.status).toBe(400);

      const stored = await fetch(`${baseUrl}/api/mood-entries`).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(stored.entries[0].taskIds).toEqual([]);
    });
  });
});
