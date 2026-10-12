import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { loadPromptDirectingSkill } from "./prompt-directing-skill.js";
import type {
  DiscussionAgent,
  DiscussionAgentMessage,
  DiscussionAgentOptions,
  DiscussionAgentReply,
  DiscussionMood,
} from "./types.js";

export function discussionScopeInstructions(options: DiscussionAgentOptions): string {
  if (options.compositionMode === "album") {
    const count = options.candidateCount ? `${options.candidateCount} candidate pieces` : "a set of candidate pieces";
    const duration = options.targetTotalMinutes ? ` and an approximate total duration of ${options.targetTotalMinutes} minutes` : "";
    return `
Creative scope: this is a cohesive themed album, not a single track. It should establish one shared sound world while allowing functional variation across ${count}${duration}.
- In discussion, frame recommendations as an album-level direction: shared identity, contrasting uses or energy levels, and how pieces belong together.
- In the final proposal, begin by explicitly requesting an original themed album or collection. Never phrase the result as one song, one track, or a standalone piece.
- Do not write a complete track list unless the user explicitly asks for one.
`.trim();
  }
  if (options.compositionMode === "orchestral") {
    return `
Creative scope: this is one multi-movement orchestral work, not a standalone song. Discuss its shared thematic material, dramatic arc, and movement-to-movement contrast.
`.trim();
  }
  return "Creative scope: this is one standalone music piece.";
}

function userMessage(message: DiscussionAgentMessage): HumanMessage {
  if (!message.images.length) return new HumanMessage(message.content || "Please discuss this image as a music reference.");
  return new HumanMessage({
    content: [
      { type: "text", text: message.content || "Please discuss this image as a music reference." },
      ...message.images.map((image) => ({
        type: "image_url" as const,
        image_url: { url: image.dataUrl, detail: "auto" as const },
      })),
    ],
  });
}

function conversation(messages: DiscussionAgentMessage[]): BaseMessage[] {
  return messages.map((message) => message.role === "assistant"
    ? new AIMessage(message.content)
    : userMessage(message));
}

function responseText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.flatMap((block) => {
      if (typeof block === "string") return [block];
      if (block && typeof block === "object" && "text" in block && typeof block.text === "string") return [block.text];
      return [];
    }).join("\n").trim();
  }
  return "";
}

const discussionReplySchema = z.object({
  content: z.string().describe(
    "A four-to-six-sentence direction draft in the user's language that carries the user's feeling inside musical imagery instead of naming it separately.",
  ),
  mood: z.object({
    label: z.string().describe("A short label for the feeling the user expressed, in the user's language."),
    imagery: z.string().describe("The musical image that carries that feeling, in the user's language."),
  }),
});

function normalizeMood(value: unknown): DiscussionMood | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { label, imagery } = value as { label?: unknown; imagery?: unknown };
  const labelText = typeof label === "string" ? label.trim() : "";
  const imageryText = typeof imagery === "string" ? imagery.trim() : "";
  return labelText && imageryText ? { label: labelText, imagery: imageryText } : undefined;
}

function model(options: DiscussionAgentOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
    useResponsesApi: true,
  });
}

export class LangChainDiscussionAgent implements DiscussionAgent {
  async respond(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<DiscussionAgentReply> {
    const instructions = await loadPromptDirectingSkill("discussion");
    const conversationMessages = [
      new SystemMessage(`${instructions}\n\n${discussionScopeInstructions(options)}`),
      ...conversation(messages),
    ];
    let structured: z.infer<typeof discussionReplySchema> | undefined;
    try {
      structured = await model(options)
        .withStructuredOutput(discussionReplySchema, { name: "discussion_reply" })
        .invoke(conversationMessages);
    } catch {
      // Fall back to a plain-text turn when structured output is unavailable for this model or API mode.
    }
    if (!structured) {
      const fallback = await model(options).invoke(conversationMessages);
      const content = responseText(fallback.content);
      if (!content) throw new Error("The Prompt Director returned an empty response.");
      return { content };
    }
    const content = responseText(structured.content);
    if (!content) throw new Error("The Prompt Director returned an empty response.");
    const mood = normalizeMood(structured.mood);
    return mood ? { content, mood } : { content };
  }

  async propose(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<string> {
    const instructions = await loadPromptDirectingSkill("proposal");
    const result = await model(options).invoke([
      new SystemMessage(`${instructions}\n\n${discussionScopeInstructions(options)}`),
      ...conversation(messages),
      new HumanMessage("Create the final concise prompt from this discussion now."),
    ]);
    const text = responseText(result.content);
    if (!text) throw new Error("The Prompt Director returned an empty prompt.");
    return text;
  }
}
