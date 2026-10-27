import { mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { writeTextFileAtomic } from "../utils/files.js";
import { KeyedQueue } from "../utils/queues.js";
import { isRecord } from "../utils/validation.js";
import {
  DISCUSSION_IMAGE_TYPES,
  MAX_DISCUSSION_ATTACHMENTS,
  MAX_DISCUSSION_IMAGE_BYTES,
  type CreativeSession,
  type DiscussionAttachment,
  type DiscussionImageType,
  type DiscussionMood,
  type DiscussionTaskOptions,
} from "./types.js";

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/u.test(value);
}

function isSession(value: unknown): value is CreativeSession {
  return isRecord(value)
    && isSafeId(value.id)
    && ["discussing", "proposal-ready", "submitted"].includes(String(value.status))
    && isRecord(value.taskOptions)
    && Array.isArray(value.messages)
    && Array.isArray(value.attachments)
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

export class CreativeSessionStore {
  readonly #directory: string;
  readonly #sessions = new Map<string, CreativeSession>();
  /** One mutation at a time per discussion: read, derive, persist, publish. */
  readonly #mutations = new KeyedQueue();

  constructor(directory: string) {
    this.#directory = path.resolve(directory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    for (const entry of await readdir(this.#directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
      try {
        const value: unknown = JSON.parse(await readFile(path.join(this.#directory, entry.name, "session.json"), "utf8"));
        if (isSession(value)) this.#sessions.set(value.id, value);
      } catch {
        // Preserve malformed session data on disk without exposing it at runtime.
      }
    }
  }

  get(id: string): CreativeSession | undefined {
    return this.#sessions.get(id);
  }

  list(): CreativeSession[] {
    return [...this.#sessions.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  /** Removes the discussion record together with its uploaded images. */
  async delete(id: string): Promise<boolean> {
    return this.#mutations.run(id, async () => {
      if (!this.#sessions.has(id)) return false;
      // Remove the files first: a failed delete keeps a usable record to retry.
      await rm(this.sessionDirectory(id), { recursive: true, force: true });
      this.#sessions.delete(id);
      return true;
    });
  }

  async create(taskOptions: DiscussionTaskOptions): Promise<CreativeSession> {
    const now = new Date().toISOString();
    const session: CreativeSession = {
      id: crypto.randomUUID(), status: "discussing", taskOptions,
      messages: [], attachments: [], createdAt: now, updatedAt: now,
    };
    await this.save(session);
    this.#sessions.set(session.id, session);
    return session;
  }

  async addAttachment(
    id: string,
    input: { originalName: string; mimeType: string; data: Buffer },
  ): Promise<CreativeSession> {
    return this.mutate(id, async (session) => {
      if (session.status === "submitted") throw new Error("This discussion has already been submitted.");
      if (!DISCUSSION_IMAGE_TYPES.includes(input.mimeType as DiscussionImageType)) {
        throw new Error("Only JPEG, PNG, and WebP discussion images are supported.");
      }
      if (!input.data.length || input.data.length > MAX_DISCUSSION_IMAGE_BYTES) {
        throw new Error("Discussion images must be between 1 byte and 8 MiB.");
      }
      if (session.attachments.length >= MAX_DISCUSSION_ATTACHMENTS) {
        throw new Error(`A discussion supports at most ${MAX_DISCUSSION_ATTACHMENTS} images.`);
      }
      const mimeType = input.mimeType as DiscussionImageType;
      const attachmentId = crypto.randomUUID();
      const fileName = `${attachmentId}${extensionFor(mimeType)}`;
      const now = new Date().toISOString();
      const attachment: DiscussionAttachment = {
        id: attachmentId,
        originalName: cleanOriginalName(input.originalName),
        fileName,
        mimeType,
        size: input.data.length,
        createdAt: now,
      };
      const attachmentsDirectory = path.join(this.sessionDirectory(session.id), "attachments");
      await mkdir(attachmentsDirectory, { recursive: true });
      const attachmentPath = path.join(attachmentsDirectory, fileName);
      await writeFile(attachmentPath, input.data, { flag: "wx" });
      return {
        next: { ...session, attachments: [...session.attachments, attachment], updatedAt: now },
        // A record that never reached disk must not keep its uploaded image.
        rollback: () => unlink(attachmentPath).catch(() => undefined),
      };
    });
  }

  async addMessage(
    id: string,
    role: "user" | "assistant",
    content: string,
    attachmentIds: string[] = [],
    mood?: DiscussionMood,
  ): Promise<CreativeSession> {
    return this.mutate(id, (session) => {
      if (session.status === "submitted") throw new Error("This discussion has already been submitted.");
      const text = content.trim();
      if (!text && !attachmentIds.length) throw new Error("A discussion message or image is required.");
      if (text.length > 8_000) throw new Error("Discussion messages must be 8,000 characters or fewer.");
      if (role === "assistant" && attachmentIds.length) throw new Error("Assistant messages cannot attach local images.");
      const known = new Set(session.attachments.map((attachment) => attachment.id));
      if (attachmentIds.some((attachmentId) => !known.has(attachmentId))) {
        throw new Error("A discussion attachment is unavailable.");
      }
      const now = new Date().toISOString();
      const { proposal: _proposal, ...withoutProposal } = session;
      const updated: CreativeSession = {
        ...withoutProposal,
        status: "discussing",
        messages: [...session.messages, {
          id: crypto.randomUUID(), role, content: text, attachmentIds: [...new Set(attachmentIds)], createdAt: now,
          ...(role === "assistant" && mood ? { mood } : {}),
        }],
        updatedAt: now,
      };
      return { next: updated };
    });
  }

  async setProposal(id: string, proposal: string): Promise<CreativeSession> {
    return this.mutate(id, (session) => {
      if (session.status === "submitted") throw new Error("This discussion has already been submitted.");
      if (!session.messages.some((message) => message.role === "user")) {
        throw new Error("Discuss the music before generating a prompt.");
      }
      const text = proposal.trim();
      if (!text) throw new Error("The generated prompt is empty.");
      if (text.length > 8_000) throw new Error("The generated prompt must be 8,000 characters or fewer.");
      const updated: CreativeSession = {
        ...session, status: "proposal-ready", proposal: text, updatedAt: new Date().toISOString(),
      };
      return { next: updated };
    });
  }

  async markSubmitted(id: string, taskId: string, proposal: string): Promise<CreativeSession> {
    return this.mutate(id, (session) => {
      const taskIds = [...new Set([...(session.taskIds ?? []), taskId])];
      const updated: CreativeSession = {
        ...session, status: "submitted", proposal: proposal.trim(), submittedTaskId: taskId,
        taskIds,
        updatedAt: new Date().toISOString(),
      };
      return { next: updated };
    });
  }

  attachmentPath(id: string, attachmentId: string): { path: string; mimeType: DiscussionImageType } | undefined {
    const session = this.get(id);
    const attachment = session?.attachments.find((candidate) => candidate.id === attachmentId);
    if (!session || !attachment || !isSafeId(attachment.id)) return undefined;
    return {
      path: path.join(this.sessionDirectory(session.id), "attachments", attachment.fileName),
      mimeType: attachment.mimeType,
    };
  }

  async agentMessages(id: string) {
    const session = this.require(id);
    return Promise.all(session.messages.map(async (message) => ({
      role: message.role,
      content: message.content,
      images: await Promise.all(message.attachmentIds.map(async (attachmentId) => {
        const attachment = session.attachments.find((candidate) => candidate.id === attachmentId);
        if (!attachment) throw new Error("A discussion attachment is unavailable.");
        const data = await readFile(path.join(this.sessionDirectory(id), "attachments", attachment.fileName));
        return { mimeType: attachment.mimeType, dataUrl: `data:${attachment.mimeType};base64,${data.toString("base64")}` };
      })),
    })));
  }

  private require(id: string): CreativeSession {
    const session = this.get(id);
    if (!session) throw new Error("Discussion session not found.");
    return session;
  }

  /**
   * The single mutation path for one discussion: derive the next record from the
   * current one, persist it, then publish it. A failed write leaves memory
   * unchanged. `derive` must not re-enter this discussion's lock.
   */
  private mutate(
    id: string,
    derive: (current: CreativeSession) => { next: CreativeSession; rollback?: () => Promise<void> }
      | Promise<{ next: CreativeSession; rollback?: () => Promise<void> }>,
  ): Promise<CreativeSession> {
    return this.#mutations.run(id, async () => {
      const current = this.#sessions.get(id);
      if (!current) throw new Error("Discussion session not found.");
      const { next, rollback } = await derive(current);
      try {
        await this.save(next);
      } catch (error) {
        await rollback?.();
        throw error;
      }
      this.#sessions.set(id, next);
      return next;
    });
  }

  private sessionDirectory(id: string): string {
    return path.join(this.#directory, id);
  }

  private save(session: CreativeSession): Promise<void> {
    return writeTextFileAtomic(
      path.join(this.sessionDirectory(session.id), "session.json"),
      `${JSON.stringify(session, null, 2)}\n`,
    );
  }
}
