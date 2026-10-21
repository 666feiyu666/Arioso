import type { CreateTaskInput } from "../web/task-store.js";

export const DISCUSSION_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DISCUSSION_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DISCUSSION_ATTACHMENTS = 4;

export type DiscussionImageType = (typeof DISCUSSION_IMAGE_TYPES)[number];
export type DiscussionTaskOptions = Omit<CreateTaskInput, "description" | "sourceDiscussionId">;
export type CreativeSessionStatus = "discussing" | "proposal-ready" | "submitted";

export interface DiscussionAttachment {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: DiscussionImageType;
  size: number;
  createdAt: string;
}

export interface DiscussionMood {
  label: string;
  imagery: string;
}

export interface DiscussionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentIds: string[];
  mood?: DiscussionMood;
  createdAt: string;
}

export interface CreativeSession {
  id: string;
  status: CreativeSessionStatus;
  taskOptions: DiscussionTaskOptions;
  messages: DiscussionMessage[];
  attachments: DiscussionAttachment[];
  proposal?: string;
  submittedTaskId?: string;
  taskIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionImageInput {
  mimeType: DiscussionImageType;
  dataUrl: string;
}

export interface DiscussionAgentMessage {
  role: DiscussionMessage["role"];
  content: string;
  images: DiscussionImageInput[];
}

export interface DiscussionAgentReply {
  content: string;
  mood?: DiscussionMood;
}

/**
 * One retrieved modern poem offered to the Director at proposal time. It is
 * reference material, never part of the user's request.
 */
export interface PoemReference {
  id: string;
  title: string;
  author: string;
  text: string;
  score: number;
  matchedTerms: string[];
}

export interface DiscussionAgentOptions {
  apiKey: string;
  model: string;
  language: "zh-CN" | "en";
  compositionMode: DiscussionTaskOptions["compositionMode"];
  workflowType: DiscussionTaskOptions["workflowType"];
  candidateCount?: number | undefined;
  targetTotalMinutes?: number | undefined;
}

export interface DiscussionAgent {
  respond(messages: DiscussionAgentMessage[], options: DiscussionAgentOptions): Promise<DiscussionAgentReply>;
  propose(
    messages: DiscussionAgentMessage[],
    options: DiscussionAgentOptions,
    poems?: PoemReference[],
  ): Promise<string>;
}
