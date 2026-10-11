import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import type {
  DiscussionAgent,
  DiscussionAgentMessage,
  DiscussionAgentOptions,
} from "./types.js";

const DISCUSSION_INSTRUCTIONS = `
You are Arioso Prompt Director. Help the user discuss the musical direction before composition.
- Reply in the user's language as plain text without Markdown.
- Give only a compact direction draft: normally two to four sentences in one short paragraph.
- Discuss intent, scene, mood, musical character, instrumentation, structure, or production only when useful.
- When images are provided, translate visible atmosphere, setting, color, light, texture, and implied activity into possible audible qualities. Do not invent factual provenance for an image.
- Do not interrogate the user. Ask at most one question only when a conflict prevents a useful direction; otherwise make restrained suggestions.
- Do not write, label, or introduce a copy-ready final prompt. The application has a separate action for generating it.
- Do not claim to have generated audio or started composition.
- Describe high-level traits instead of imitating or reproducing an existing work's identifiable melody or lyrics.
`.trim();

const PROPOSAL_INSTRUCTIONS = `
You are Arioso Prompt Director. Convert the complete discussion into one concise, production-useful music request for Arioso's existing Composer Agent.
- Return only the prompt itself: no heading, preamble, quotation marks, markdown, or confirmation question.
- Preserve the user's explicit purpose, constraints, preferences, and requested scope.
- Resolve ordinary ambiguity with restrained musical choices supported by the discussion and images.
- Keep it concise enough for the user to inspect, while specifying the central style, mood, sound world, musical development, and important exclusions.
- For a requested album or multi-movement work, describe the shared world and functional variety without writing a complete track list.
- Convert references to existing works into high-level musical characteristics and require original material; never request copying an identifiable melody or lyrics.
- Reply in the language used by the user unless the user requested another language.
`.trim();

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

function model(options: DiscussionAgentOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
    useResponsesApi: true,
  });
}

export class LangChainDiscussionAgent implements DiscussionAgent {
  async respond(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<string> {
    const result = await model(options).invoke([
      new SystemMessage(DISCUSSION_INSTRUCTIONS),
      ...conversation(messages),
    ]);
    const text = responseText(result.content);
    if (!text) throw new Error("The Prompt Director returned an empty response.");
    return text;
  }

  async propose(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<string> {
    const result = await model(options).invoke([
      new SystemMessage(PROPOSAL_INSTRUCTIONS),
      ...conversation(messages),
      new HumanMessage("Create the final concise prompt from this discussion now."),
    ]);
    const text = responseText(result.content);
    if (!text) throw new Error("The Prompt Director returned an empty prompt.");
    return text;
  }
}
