import { describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

// A 1x1 transparent PNG.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const stubAgent = {
  respond: async () => ({ content: "A quiet piano direction.", mood: { label: "calm", imagery: "dusk" } }),
  propose: async () => "Compose a quiet piano piece.",
};

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
      const { response, chat } = await createChat(baseUrl, { jazz: true });
      expect(response.status).toBe(201);
      expect(chat).toMatchObject({ status: "discussing", jazz: true, messages: [], taskIds: [] });

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
});
