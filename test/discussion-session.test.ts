import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CreativeSessionStore } from "../src/discussion/creative-session-store.js";

import type {
  DiscussionAgent,
  DiscussionAgentMessage,
  DiscussionAgentOptions,
  DiscussionAgentReply,
} from "../src/discussion/types.js";
import { discussionScopeInstructions } from "../src/discussion/langchain-discussion.js";
import { withWebServer } from "./helpers/web-server.js";

const { composeMock, planAlbumMock } = vi.hoisted(() => ({ composeMock: vi.fn(), planAlbumMock: vi.fn() }));
vi.mock("../src/composer/composer-agent.js", () => ({ composeMusic: composeMock }));
vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: planAlbumMock,
  composeAlbumTrack: vi.fn(),
  reviewAlbumCandidates: vi.fn(),
  reviseAlbumTrack: vi.fn(),
}));
vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = vi.fn(); },
}));

function musicSpec(title = "Approved direction") {
  return {
    schemaVersion: "1.0", title, intent: "test", genres: ["ambient"], moods: ["calm"],
    tempo: { bpm: 72, feel: "unhurried" }, tonality: { tonic: null, mode: null }, meter: "4/4",
    instrumentation: [{ name: "piano", role: "lead", timbre: "warm" }],
    structure: [{ section: "Arc", durationSeconds: 30, direction: "settle gently" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "clean and warm", avoid: ["vocals"], assumptions: [], lyriaPrompt: "warm piano",
  };
}

class StubDiscussionAgent implements DiscussionAgent {
  calls: DiscussionAgentMessage[][] = [];
  options: DiscussionAgentOptions[] = [];
  async respond(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<DiscussionAgentReply> {
    this.calls.push(messages);
    this.options.push(options);
    return {
      content: "适合温暖、安静、略带怀旧感的下班后音乐。",
      mood: { label: "平静的怀旧", imagery: "黄昏里慢慢暗下来的暖色灯光" },
    };
  }
  async propose(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<string> {
    this.calls.push(messages);
    this.options.push(options);
    return "创作温暖安静的下班后放松音乐，以柔和钢琴和自然空间感为核心。";
  }
}

async function createSession(baseUrl: string, input: Record<string, unknown> = {
  mode: "compose", workflowType: "01-general", vocalMode: "instrumental",
}) {
  const response = await fetch(`${baseUrl}/api/discussions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string }>;
}

describe("creative discussion sessions", () => {
  it("supports text-only discussion without creating a music task", async () => {
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ baseUrl }) => {
      const session = await createSession(baseUrl);
      const response = await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "我想做一张温暖但不过分悲伤的音乐专辑。" }),
      });
      expect(response.status).toBe(200);
      const updated = await response.json() as {
        messages: Array<{ role: string; content: string; mood?: { label: string; imagery: string } }>;
      };
      expect(updated.messages.map((message: { role: string }) => message.role)).toEqual(["user", "assistant"]);
      expect(updated.messages[1]!.content).toContain("温暖");
      expect(updated.messages[1]!.mood).toEqual({ label: "平静的怀旧", imagery: "黄昏里慢慢暗下来的暖色灯光" });
      expect(agent.options[0]).toMatchObject({ compositionMode: "single", workflowType: "01-general" });
      expect(await fetch(`${baseUrl}/api/tasks`).then((result) => result.json())).toEqual([]);
    }, { environment: { OPENAI_API_KEY: "test-local-only" }, discussionAgent: agent });
  });

  it("preserves themed album scope for the discussion and final proposal", async () => {
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ baseUrl }) => {
      const session = await createSession(baseUrl, {
        mode: "generate", workflowType: "04-album", vocalMode: "instrumental", compositionMode: "album",
        candidateCount: 14, targetTotalMinutes: 35, lyriaModel: "lyria-3.5",
      });
      await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "做一张夜晚凯尔特酒馆主题专辑。" }),
      });
      const proposal = await fetch(`${baseUrl}/api/discussions/${session.id}/proposal`, { method: "POST" });
      expect(proposal.status).toBe(200);
      expect(agent.options).toHaveLength(2);
      expect(agent.options).toEqual(expect.arrayContaining([
        expect.objectContaining({ compositionMode: "album", workflowType: "04-album", candidateCount: 14, targetTotalMinutes: 35 }),
      ]));
    }, { environment: { OPENAI_API_KEY: "test-local-only" }, discussionAgent: agent });
    expect(discussionScopeInstructions({
      apiKey: "test", model: "test", language: "zh-CN", compositionMode: "album", workflowType: "04-album",
      candidateCount: 14, targetTotalMinutes: 35,
    })).toContain("not a single track");
  });

  it("sends locally stored images into the same multimodal discussion", async () => {
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ root, baseUrl }) => {
      const session = await createSession(baseUrl);
      const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const uploadedResponse = await fetch(
        `${baseUrl}/api/discussions/${session.id}/attachments?name=reference.png`,
        { method: "POST", headers: { "Content-Type": "image/png" }, body: image },
      );
      expect(uploadedResponse.status).toBe(201);
      const uploaded = await uploadedResponse.json() as { attachments: Array<{ id: string }> };
      const attachment = uploaded.attachments[0];
      expect(attachment).toBeDefined();
      const discussed = await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "下班后放松时听。", attachmentIds: [attachment!.id] }),
      });
      expect(discussed.status).toBe(200);
      expect(agent.calls[0]?.[0]?.images[0]?.dataUrl).toBe(`data:image/png;base64,${image.toString("base64")}`);
      const imageResponse = await fetch(`${baseUrl}/api/discussions/${session.id}/attachments/${attachment!.id}`);
      expect(Buffer.from(await imageResponse.arrayBuffer())).toEqual(image);
      const record = JSON.parse(await readFile(path.join(root, "outputs", "discussions", session.id, "session.json"), "utf8"));
      expect(JSON.stringify(record)).not.toContain(image.toString("base64"));
    }, { environment: { OPENAI_API_KEY: "test-local-only" }, discussionAgent: agent });
  });

  it("passes the visible approved prompt unchanged into the existing task pipeline", async () => {
    composeMock.mockResolvedValue(musicSpec());
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ baseUrl }) => {
      const session = await createSession(baseUrl);
      await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "适合下班后放松。" }),
      });
      const proposalResponse = await fetch(`${baseUrl}/api/discussions/${session.id}/proposal`, { method: "POST" });
      const proposed = await proposalResponse.json() as { proposal: string };
      expect(proposed.proposal).toContain("下班后");

      const approvedPrompt = "原创的温暖夜间器乐，适合下班后放松，不使用强烈鼓点。";
      const submittedResponse = await fetch(`${baseUrl}/api/discussions/${session.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: approvedPrompt }),
      });
      expect(submittedResponse.status).toBe(202);
      const submitted = await submittedResponse.json() as {
        task: { id: string; description: string; sourceDiscussionId: string; mode: string };
        session: { status: string; proposal: string; submittedTaskId: string };
      };
      expect(submitted.task).toMatchObject({
        description: approvedPrompt, sourceDiscussionId: session.id, mode: "compose",
      });
      expect(submitted.session).toMatchObject({
        status: "submitted", proposal: approvedPrompt, submittedTaskId: submitted.task.id,
      });
      await vi.waitFor(async () => {
        const task = await fetch(`${baseUrl}/api/tasks/${submitted.task.id}`)
          .then((response) => response.json()) as { status: string };
        expect(task.status).toBe("completed");
      });
      const restored = await fetch(`${baseUrl}/api/discussions/${session.id}`)
        .then((response) => response.json()) as {
          phase: string; taskIds: string[]; tasks: Array<{ id: string; status: string }>;
        };
      expect(restored).toMatchObject({
        phase: "completed",
        taskIds: [submitted.task.id],
        tasks: [{ id: submitted.task.id, status: "completed" }],
      });
      const sessions = await fetch(`${baseUrl}/api/discussions`)
        .then((response) => response.json()) as Array<{ id: string }>;
      expect(sessions.map((item) => item.id)).toContain(session.id);
      expect(composeMock).toHaveBeenCalledWith(approvedPrompt, expect.any(Object));
    }, { environment: { OPENAI_API_KEY: "test-local-only" }, discussionAgent: agent });
  });

  it("applies the generation settings chosen after the discussion", async () => {
    composeMock.mockResolvedValue(musicSpec());
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ baseUrl }) => {
      const session = await createSession(baseUrl, {
        mode: "compose", workflowType: "01-general", vocalMode: "auto",
      });
      await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "适合下班后放松。" }),
      });
      const submitted = await fetch(`${baseUrl}/api/discussions/${session.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "原创温暖夜间器乐", mode: "compose", lyriaModel: "lyria-3.5", vocalMode: "vocals" }),
      });
      expect(submitted.status).toBe(202);
      const result = await submitted.json() as { task: { id: string; mode: string; lyriaModel: string; vocalMode: string } };
      expect(result.task).toMatchObject({ mode: "compose", lyriaModel: "lyria-3.5", vocalMode: "vocals" });
      await vi.waitFor(async () => {
        const task = await fetch(`${baseUrl}/api/tasks/${result.task.id}`)
          .then((response) => response.json()) as { status: string };
        expect(task.status).toBe("completed");
      });
    }, { environment: { OPENAI_API_KEY: "test-local-only" }, discussionAgent: agent });
  });

  it("locks generation settings for fixed-scope workflows", async () => {
    planAlbumMock.mockRejectedValue(new Error("generation is out of scope for this test"));
    const agent = new StubDiscussionAgent();
    await withWebServer(async ({ baseUrl }) => {
      const session = await createSession(baseUrl, {
        mode: "generate", workflowType: "04-album", compositionMode: "album",
        vocalMode: "instrumental", candidateCount: 14, targetTotalMinutes: 35, lyriaModel: "lyria-3.5",
      });
      await fetch(`${baseUrl}/api/discussions/${session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "做一张夜晚主题专辑。" }),
      });
      const submitted = await fetch(`${baseUrl}/api/discussions/${session.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "原创夜晚主题器乐专辑", mode: "compose", lyriaModel: "lyria-3-clip-preview", vocalMode: "vocals" }),
      });
      expect(submitted.status).toBe(202);
      const result = await submitted.json() as { task: { mode: string; lyriaModel: string; vocalMode: string } };
      expect(result.task).toMatchObject({ mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" });
    }, {
      environment: { OPENAI_API_KEY: "test-local-only", GEMINI_API_KEY: "test-local-only" },
      discussionAgent: agent,
    });
  });
});

describe("creative discussion mood persistence", () => {
  it("loads a legacy session that has no mood field", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "arioso-discussions-"));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await mkdir(path.join(directory, id), { recursive: true });
    await writeFile(path.join(directory, id, "session.json"), JSON.stringify({
      id,
      status: "discussing",
      taskOptions: { mode: "compose", workflowType: "01-general", vocalMode: "instrumental" },
      messages: [{ id: crypto.randomUUID(), role: "assistant", content: "旧回复", attachmentIds: [], createdAt: now }],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }));

    const store = new CreativeSessionStore(directory);
    await store.initialize();
    const loaded = store.get(id);
    expect(loaded?.messages[0]?.content).toBe("旧回复");
    expect(loaded?.messages[0]?.mood).toBeUndefined();
  });
});
