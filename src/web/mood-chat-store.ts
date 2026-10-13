import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DISCUSSION_IMAGE_TYPES,
  MAX_DISCUSSION_ATTACHMENTS,
  MAX_DISCUSSION_IMAGE_BYTES,
  type DiscussionAgentMessage,
  type DiscussionImageType,
  type DiscussionMood,
} from "../discussion/types.js";
import { writeTextFileAtomic } from "../utils/files.js";
import { isRecord } from "../utils/validation.js";

// MoodMic keeps its own conversations, separate from the workflow studio's
// discussion sessions. The two share the same creative-discussion capability
// but never the same records.

export type MoodChatStatus = "discussing" | "proposal-ready" | "submitted";

export interface MoodChatAttachment {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: DiscussionImageType;
  size: number;
  createdAt: string;
}

export interface MoodChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentIds: string[];
  mood?: DiscussionMood;
  createdAt: string;
}

export interface MoodChat {
  id: string;
  status: MoodChatStatus;
  /** Whether the "why not jazz" reference corpus is on for this chat. */
  jazz: boolean;
  messages: MoodChatMessage[];
  attachments: MoodChatAttachment[];
  proposal?: string;
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/u.test(value);
}

function isMoodChat(value: unknown): value is MoodChat {
  return isRecord(value)
    && isSafeId(value.id)
    && ["discussing", "proposal-ready", "submitted"].includes(String(value.status))
    && typeof value.jazz === "boolean"
    && Array.isArray(value.messages)
    && Array.isArray(value.attachments)
    && Array.isArray(value.taskIds)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function extensionFor(mimeType: DiscussionImageType): string {
  return mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : ".webp";
}

function cleanOriginalName(value: string): string {
  const name = path.basename(value.trim()).replace(/[\u0000-\u001f<>:"/\\|?*]/gu, "-");
  return name.slice(0, 120) || "image";
}

export class MoodChatStore {
  readonly #directory: string;
  readonly #chats = new Map<string, MoodChat>();

  constructor(directory: string) {
    this.#directory = path.resolve(directory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    for (const entry of await readdir(this.#directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
      try {
        const value: unknown = JSON.parse(await readFile(path.join(this.#directory, entry.name, "session.json"), "utf8"));
        if (isMoodChat(value)) this.#chats.set(value.id, value);
      } catch {
        // Preserve malformed chat data on disk without exposing it at runtime.
      }
    }
  }

  get(id: string): MoodChat | undefined {
    return this.#chats.get(id);
  }

  list(): MoodChat[] {
    return [...this.#chats.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(jazz = false): Promise<MoodChat> {
    const now = new Date().toISOString();
    const chat: MoodChat = {
      id: crypto.randomUUID(), status: "discussing", jazz,
      messages: [], attachments: [], taskIds: [], createdAt: now, updatedAt: now,
    };
    this.#chats.set(chat.id, chat);
    await this.save(chat);
    return chat;
  }

  async addAttachment(
    id: string,
    input: { originalName: string; mimeType: string; data: Buffer },
  ): Promise<MoodChat> {
    const chat = this.require(id);
    if (chat.status === "submitted") throw new Error("This conversation has already been submitted.");
    if (!DISCUSSION_IMAGE_TYPES.includes(input.mimeType as DiscussionImageType)) {
      throw new Error("Only JPEG, PNG, and WebP images are supported.");
    }
    if (!input.data.length || input.data.length > MAX_DISCUSSION_IMAGE_BYTES) {
      throw new Error("Images must be between 1 byte and 8 MiB.");
    }
    if (chat.attachments.length >= MAX_DISCUSSION_ATTACHMENTS) {
      throw new Error(`A conversation supports at most ${MAX_DISCUSSION_ATTACHMENTS} images.`);
    }
    const mimeType = input.mimeType as DiscussionImageType;
    const attachmentId = crypto.randomUUID();
    const fileName = `${attachmentId}${extensionFor(mimeType)}`;
    const now = new Date().toISOString();
    const attachment: MoodChatAttachment = {
      id: attachmentId,
      originalName: cleanOriginalName(input.originalName),
      fileName,
      mimeType,
      size: input.data.length,
      createdAt: now,
    };
    const attachmentsDirectory = path.join(this.chatDirectory(chat.id), "attachments");
    await mkdir(attachmentsDirectory, { recursive: true });
    await writeFile(path.join(attachmentsDirectory, fileName), input.data, { flag: "wx" });
    const updated = { ...chat, attachments: [...chat.attachments, attachment], updatedAt: now };
    this.#chats.set(id, updated);
    await this.save(updated);
    return updated;
  }

  async addMessage(
    id: string,
    role: "user" | "assistant",
    content: string,
    attachmentIds: string[] = [],
    mood?: DiscussionMood,
  ): Promise<MoodChat> {
    const chat = this.require(id);
    if (chat.status === "submitted") throw new Error("This conversation has already been submitted.");
    const text = content.trim();
    if (!text && !attachmentIds.length) throw new Error("A message or image is required.");
    if (text.length > 8_000) throw new Error("Messages must be 8,000 characters or fewer.");
    if (role === "assistant" && attachmentIds.length) throw new Error("Assistant messages cannot attach images.");
    const known = new Set(chat.attachments.map((attachment) => attachment.id));
    if (attachmentIds.some((attachmentId) => !known.has(attachmentId))) {
      throw new Error("An attachment is unavailable.");
    }
    const now = new Date().toISOString();
    const { proposal: _proposal, ...withoutProposal } = chat;
    const updated: MoodChat = {
      ...withoutProposal,
      status: "discussing",
      messages: [...chat.messages, {
        id: crypto.randomUUID(), role, content: text, attachmentIds: [...new Set(attachmentIds)], createdAt: now,
        ...(role === "assistant" && mood ? { mood } : {}),
      }],
      updatedAt: now,
    };
    this.#chats.set(id, updated);
    await this.save(updated);
    return updated;
  }

  async setProposal(id: string, proposal: string): Promise<MoodChat> {
    const chat = this.require(id);
    if (chat.status === "submitted") throw new Error("This conversation has already been submitted.");
    if (!chat.messages.some((message) => message.role === "user")) {
      throw new Error("Discuss the music before generating a prompt.");
    }
    const text = proposal.trim();
    if (!text) throw new Error("The generated prompt is empty.");
    if (text.length > 8_000) throw new Error("The generated prompt must be 8,000 characters or fewer.");
    const updated: MoodChat = {
      ...chat, status: "proposal-ready", proposal: text, updatedAt: new Date().toISOString(),
    };
    this.#chats.set(id, updated);
    await this.save(updated);
    return updated;
  }

  async markSubmitted(id: string, taskId: string, proposal: string): Promise<MoodChat> {
    const chat = this.require(id);
    const taskIds = [...new Set([...chat.taskIds, taskId])];
    const updated: MoodChat = {
      ...chat, status: "submitted", proposal: proposal.trim(), taskIds,
      updatedAt: new Date().toISOString(),
    };
    this.#chats.set(id, updated);
    await this.save(updated);
    return updated;
  }

  attachmentPath(id: string, attachmentId: string): { path: string; mimeType: DiscussionImageType } | undefined {
    const chat = this.get(id);
    const attachment = chat?.attachments.find((candidate) => candidate.id === attachmentId);
    if (!chat || !attachment || !isSafeId(attachment.id)) return undefined;
    return {
      path: path.join(this.chatDirectory(chat.id), "attachments", attachment.fileName),
      mimeType: attachment.mimeType,
    };
  }

  async agentMessages(id: string): Promise<DiscussionAgentMessage[]> {
    const chat = this.require(id);
    return Promise.all(chat.messages.map(async (message) => ({
      role: message.role,
      content: message.content,
      images: await Promise.all(message.attachmentIds.map(async (attachmentId) => {
        const attachment = chat.attachments.find((candidate) => candidate.id === attachmentId);
        if (!attachment) throw new Error("An attachment is unavailable.");
        const data = await readFile(path.join(this.chatDirectory(id), "attachments", attachment.fileName));
        return { mimeType: attachment.mimeType, dataUrl: `data:${attachment.mimeType};base64,${data.toString("base64")}` };
      })),
    })));
  }

  private require(id: string): MoodChat {
    const chat = this.get(id);
    if (!chat) throw new Error("Conversation not found.");
    return chat;
  }

  private chatDirectory(id: string): string {
    return path.join(this.#directory, id);
  }

  private save(chat: MoodChat): Promise<void> {
    return writeTextFileAtomic(
      path.join(this.chatDirectory(chat.id), "session.json"),
      `${JSON.stringify(chat, null, 2)}\n`,
    );
  }
}
