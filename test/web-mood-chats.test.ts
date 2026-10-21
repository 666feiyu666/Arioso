import { mkdir, writeFile } from "node:fs/promises";
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

import type { DiscussionAgent, PoemReference } from "../src/discussion/types.js";
import type { PoemRetriever } from "../src/retrieval/poem-retriever.js";
import { withWebServer } from "./helpers/web-server.js";

// A 1x1 transparent PNG.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const stubAgent = {
  respond: async () => ({ content: "A quiet piano direction.", mood: { label: "calm", imagery: "dusk" } }),
  propose: async () => "Compose a quiet piano piece.",
};

const stubPoem: PoemReference = {
  id: "modern-poem-9b83621f21ab72e0",
  title: "雨巷",
  author: "戴望舒",
  text: "撑着油纸伞，独自\n彷徨在悠长、悠长\n又寂寥的雨巷",
  score: 0.42,
  matchedTerms: ["雨巷", "寂寥"],
};

const stubRetriever: PoemRetriever = {
  corpusVersion: "checksum-under-test",
  retrieve: () => [stubPoem],
  findByIds: (ids) => (ids.includes(stubPoem.id) ? [stubPoem] : []),
};

async function addUserMessage(baseUrl: string, chatId: string, content: string) {
  return fetch(`${baseUrl}/api/mood-chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, attachmentIds: [] }),
  }).then((r) => r.json()) as Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function propose(baseUrl: string, chatId: string) {
  return fetch(`${baseUrl}/api/mood-chats/${chatId}/proposal`, { method: "POST" });
}

async function createChat(baseUrl: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}/api/mood-chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, chat: await response.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("web mood chats API", () => {
  it("keeps its own conversations separate from workflow discussions", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { response, chat } = await createChat(baseUrl, { musicReference: "jazz" });
      expect(response.status).toBe(201);
      expect(chat).toMatchObject({ status: "discussing", musicReference: "jazz", messages: [], taskIds: [] });

      const chats = await fetch(`${baseUrl}/api/mood-chats`).then((r) => r.json()) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(chats).toHaveLength(1);
      expect(chats[0].id).toBe(chat.id);

      // The workflow's discussion store stays empty.
      const discussions = await fetch(`${baseUrl}/api/discussions`).then((r) => r.json());
      expect(discussions).toHaveLength(0);
    });
  });

  it("answers a message through the injected discussion agent", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      const replied = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Something quiet for the evening", attachmentIds: [] }),
      }).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(replied.messages).toHaveLength(2);
      expect(replied.messages[0]).toMatchObject({ role: "user" });
      expect(replied.messages[1]).toMatchObject({ role: "assistant", content: "A quiet piano direction." });
    }, { discussionAgent: stubAgent, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("stores an uploaded image and serves it back", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      const bytes = new Uint8Array(Buffer.from(PNG_BASE64, "base64"));
      const uploaded = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/attachments?name=ref.png`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: bytes,
      }).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(uploaded.attachments).toHaveLength(1);
      const attachmentId = uploaded.attachments[0].id;

      const image = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/attachments/${attachmentId}`);
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toContain("image/png");
    });
  });

  it("requires a discussion before a prompt can be submitted", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      const response = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Compose a quiet piano piece." }),
      });
      expect(response.status).toBe(400);
    });
  });

  it("hands retrieved poems to the Director and stores their trace", async () => {
    const captured: PoemReference[][] = [];
    const agent: DiscussionAgent = {
      respond: stubAgent.respond,
      propose: async (_messages, _options, poems = []) => {
        captured.push(poems);
        return "Compose a quiet, rain-washed piano piece.";
      },
    };
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      await addUserMessage(baseUrl, chat.id, "Something for a rainy walk home");

      const response = await propose(baseUrl, chat.id);
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(captured).toHaveLength(1);
      expect(captured[0]).toHaveLength(1);
      expect(captured[0]?.[0]?.text).toBe(stubPoem.text);
      expect(body.poem_retrieval).toMatchObject({
        corpus_version: "checksum-under-test",
        references: [{
          id: stubPoem.id,
          title: stubPoem.title,
          author: stubPoem.author,
          score: stubPoem.score,
          matched_terms: stubPoem.matchedTerms,
        }],
      });
      expect(body.poem_retrieval.query).toContain("rainy walk home");
      expect(typeof body.poem_retrieval.retrieved_at).toBe("string");
      // Full poem text stays out of the saved session.
      expect(JSON.stringify(body.poem_retrieval)).not.toContain(stubPoem.text);
    }, { discussionAgent: agent, poemRetriever: stubRetriever, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("still generates a proposal when poetry retrieval is unavailable", async () => {
    const agent: DiscussionAgent = {
      respond: stubAgent.respond,
      propose: async (_messages, _options, poems = []) => {
        expect(poems).toEqual([]);
        return "Compose a quiet piano piece.";
      },
    };
    const brokenRetriever: PoemRetriever = {
      corpusVersion: "",
      retrieve: () => { throw new Error("corpus unreadable"); },
      findByIds: () => { throw new Error("corpus unreadable"); },
    };
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      const discussed = await addUserMessage(baseUrl, chat.id, "Something for the evening");
      // Missing reference data never blocks the Director's reply.
      expect(discussed.messages.at(-1).content).toBe("A quiet piano direction.");
      const response = await propose(baseUrl, chat.id);
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.proposal).toBe("Compose a quiet piano piece.");
      expect(body.poem_retrieval.references).toEqual([]);
      expect(body.poem_retrieval.unavailable_reason).toContain("corpus unreadable");
    }, { discussionAgent: agent, poemRetriever: brokenRetriever, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("replaces the stored trace when the proposal is regenerated", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      await addUserMessage(baseUrl, chat.id, "A rainy street");
      const first = await propose(baseUrl, chat.id).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(first.poem_retrieval.references).toHaveLength(1);

      const afterMessage = await addUserMessage(baseUrl, chat.id, "Make it warmer");
      // A new user message drops the approved prompt and re-runs retrieval for
      // the changed context, so the earlier trace is never reused.
      expect(afterMessage.proposal).toBeUndefined();
      expect(afterMessage.poem_retrieval.query).toContain("warmer");
      expect(afterMessage.poem_retrieval.query_hash).not.toBe(first.poem_retrieval.query_hash);

      const second = await propose(baseUrl, chat.id).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(second.poem_retrieval.query).toContain("warmer");
      expect(second.poem_retrieval.references).toHaveLength(1);
    }, { discussionAgent: stubAgent, poemRetriever: stubRetriever, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("hands poems to the Director while discussing as well", async () => {
    const captured: PoemReference[][] = [];
    const agent: DiscussionAgent = {
      respond: async (_messages, _options, poems = []) => {
        captured.push(poems);
        return stubAgent.respond();
      },
      propose: stubAgent.propose,
    };
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      const replied = await addUserMessage(baseUrl, chat.id, "Something for a rainy walk home");
      // Only the user's own words reach the query: no Director prose, no poems.
      expect(replied.poem_retrieval.query).toContain("rainy walk home");
      expect(replied.poem_retrieval.query).not.toContain("quiet piano direction");
      expect(replied.poem_retrieval.query).not.toContain(stubPoem.text);
      expect(captured).toHaveLength(1);
      expect(captured[0]).toHaveLength(1);
      expect(captured[0]?.[0]?.text).toBe(stubPoem.text);
      expect(replied.poem_retrieval.references).toHaveLength(1);
      expect(typeof replied.poem_retrieval.query_hash).toBe("string");
      expect(JSON.stringify(replied.poem_retrieval)).not.toContain(stubPoem.text);
    }, { discussionAgent: agent, poemRetriever: stubRetriever, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("reuses the stored references while the effective context is unchanged", async () => {
    let retrievals = 0;
    const counting: PoemRetriever = {
      corpusVersion: "checksum-under-test",
      retrieve: () => { retrievals += 1; return [stubPoem]; },
      findByIds: (ids) => (ids.includes(stubPoem.id) ? [stubPoem] : []),
    };
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      await addUserMessage(baseUrl, chat.id, "A rainy street");
      expect(retrievals).toBe(1);

      // The Director's mood joins the proposal query, so this retrieves again.
      const first = await propose(baseUrl, chat.id).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(retrievals).toBe(2);

      const second = await propose(baseUrl, chat.id).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(retrievals).toBe(2);
      expect(second.poem_retrieval.query_hash).toBe(first.poem_retrieval.query_hash);
      expect(second.poem_retrieval.references).toEqual(first.poem_retrieval.references);
    }, { discussionAgent: stubAgent, poemRetriever: counting, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("submits the approved brief without forwarding poem text to the task", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl);
      await addUserMessage(baseUrl, chat.id, "A rainy street");
      await propose(baseUrl, chat.id);
      const response = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "A quiet piano piece.", mode: "compose" }),
      });
      expect(response.status).toBe(202);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.task.description).toBe("A quiet piano piece.");
      // The approved brief keeps the trace it was produced with.
      expect(body.chat.poem_retrieval.references).toHaveLength(1);
      expect(JSON.stringify(body.task)).not.toContain(stubPoem.text);
      await vi.waitFor(async () => {
        const task = await fetch(`${baseUrl}/api/tasks/${body.task.id}`).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(["completed", "failed"]).toContain(task.status);
      });
    }, { discussionAgent: stubAgent, poemRetriever: stubRetriever, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it.each([
    ["jazz", "02-music", "music", "jazz"],    ["auto", "02-music", "music", undefined],
    ["none", "01-general", "none", undefined],
  ])("maps the %s music reference onto the created task", async (reference, workflowType, corpusMode, musicType) => {
    await withWebServer(async ({ baseUrl }) => {
      const { chat } = await createChat(baseUrl, { musicReference: reference });
      await addUserMessage(baseUrl, chat.id, "Late-night listening");
      const response = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "A quiet piano piece.", mode: "compose" }),
      });
      expect(response.status).toBe(202);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.task).toMatchObject({ workflowType, corpusMode });
      if (musicType) expect(body.task.musicType).toBe(musicType);
      else expect(body.task.musicType).toBeUndefined();
      // Wait for the background compose step so the temp output directory is idle.
      await vi.waitFor(async () => {
        const task = await fetch(`${baseUrl}/api/tasks/${body.task.id}`).then((r) => r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(["completed", "failed"]).toContain(task.status);
      });
    }, { discussionAgent: stubAgent, environment: { OPENAI_API_KEY: "test-key" } });
  });

  it("loads a session saved before the poetry experiment", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const legacy = {
      id,
      status: "proposal-ready",
      jazz: false,
      messages: [{
        id: "22222222-2222-4222-8222-222222222222",
        role: "user",
        content: "An old conversation",
        attachmentIds: [],
        createdAt: "2025-01-01T00:00:00.000Z",
      }],
      attachments: [],
      proposal: "Compose a quiet piano piece.",
      taskIds: [],
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/mood-chats/${id}`);
      expect(response.status).toBe(200);
      const body = await response.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.proposal).toBe("Compose a quiet piano piece.");
      expect(body.poem_retrieval).toBeUndefined();
    }, {
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "moodmic", "chats", id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "session.json"), JSON.stringify(legacy), "utf8");
      },
    });
  });
});
