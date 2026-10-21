import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BaseMessage } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

const mocks = vi.hoisted(() => ({ structured: vi.fn(), plain: vi.fn() }));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    withStructuredOutput(schema: z.ZodType) {
      return { invoke: async (messages: BaseMessage[]) => schema.parse(await mocks.structured(messages)) };
    }
    invoke = mocks.plain;
  },
}));

import { LangChainDiscussionAgent } from "../src/discussion/langchain-discussion.js";
import type { DiscussionAgentOptions, PoemReference } from "../src/discussion/types.js";
import { buildPoemQuery, type MoodLexicon } from "../src/retrieval/poem-retriever.js";
import { MoodChatStore } from "../src/web/mood-chat-store.js";

const options: DiscussionAgentOptions = {
  apiKey: "test-local-only", model: "test", language: "zh-CN",
  compositionMode: "single", workflowType: "01-general",
};
const lexicon: MoodLexicon = { version: "test", categories: {}, singleCharacterTokens: [], stopTerms: [] };
const agent = new LangChainDiscussionAgent();

describe("Director discussion responses", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps a feeling without requiring invented imagery through storage and retrieval", async () => {
    const input = "有点累，也有点孤单。";
    const content = "想听点什么陪着你？";
    mocks.structured.mockResolvedValue({ content, mood: { label: " 疲惫与孤单 ", imagery: "  " } });
    const reply = await agent.respond([{ role: "user", content: input, images: [] }], options);
    expect(reply).toEqual({ content, mood: { label: "疲惫与孤单", imagery: "" } });
    expect(mocks.plain).not.toHaveBeenCalled();

    const directory = await mkdtemp(path.join(tmpdir(), "arioso-director-"));
    try {
      const store = new MoodChatStore(directory);
      await store.initialize();
      const chat = await store.create("none");
      await store.addMessage(chat.id, "user", input);
      await store.addMessage(chat.id, "assistant", reply.content, [], reply.mood);
      const restored = new MoodChatStore(directory);
      await restored.initialize();
      const savedMood = restored.get(chat.id)!.messages[1]!.mood;
      expect(savedMood).toEqual(reply.mood);
      expect(buildPoemQuery({ userMessages: [input], mood: savedMood }, lexicon))
        .toBe(`${input} 疲惫与孤单`);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves an established user image for later retrieval", async () => {
    const content = "那就沿着你说的楼梯往上写。";
    const mood = { label: "兴奋", imagery: "一级一级爬学校楼梯" };
    mocks.structured.mockResolvedValue({ content, mood });
    const reply = await agent.respond([
      { role: "user", content: "像一级一级爬学校楼梯那种兴奋。", images: [] },
    ], options);
    expect(reply.mood).toEqual(mood);
    expect(buildPoemQuery({ userMessages: [], mood: reply.mood }, lexicon))
      .toBe("兴奋 一级一级爬学校楼梯");
  });

  it("accepts a direct correction without inventing a mood", async () => {
    mocks.structured.mockResolvedValue({ content: "好，不用钢琴。", mood: { label: "", imagery: "" } });
    await expect(agent.respond([{ role: "user", content: "不要钢琴。", images: [] }], options))
      .resolves.toEqual({ content: "好，不用钢琴。" });
    expect(mocks.plain).not.toHaveBeenCalled();
  });

  it("keeps first-turn poem references in both structured and fallback calls", async () => {
    const poems: PoemReference[] = [{
      id: "test-poem", title: "Test reference", author: "Test author",
      text: "A deliberately plain reference fixture.", score: 1, matchedTerms: [],
    }];
    mocks.structured.mockRejectedValue(new Error("Structured output unavailable"));
    mocks.plain.mockResolvedValue({ content: "先把摇滚这个方向保留下来。" });
    const user = { role: "user" as const, content: "心情不好，想听摇滚。", images: [] };
    await expect(agent.respond([user], options, poems))
      .resolves.toEqual({ content: "先把摇滚这个方向保留下来。" });
    const messages = mocks.structured.mock.calls[0]![0] as BaseMessage[];
    expect(messages).toHaveLength(3);
    expect(String(messages[1]!.content)).toContain(poems[0]!.text);
    expect(messages[2]!.content).toBe(user.content);
    expect(mocks.plain).toHaveBeenCalledWith(messages);
  });

  it("returns an editable two-paragraph brief intact", async () => {
    const brief = "沿着学校楼梯一级一级向上，期待随着脚步增长。\n\n原创爵士乐，接近三分钟，黑管和长笛，不用钢琴。";
    mocks.plain.mockResolvedValue({ content: `  ${brief}\n` });
    await expect(agent.propose([
      { role: "user", content: "用学校楼梯的感觉，黑管和长笛，不要钢琴。", images: [] },
    ], options)).resolves.toBe(brief);
    expect(mocks.structured).not.toHaveBeenCalled();
  });
});
