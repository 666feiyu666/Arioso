import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface OrchestralKnowledgeCard {
  id: string;
  title: string;
  content: string;
  contentHash: string;
}

export type OrchestralCardSummary = Pick<OrchestralKnowledgeCard, "id" | "title">;

export function isOrchestralCardId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

async function readCards(directory: string): Promise<OrchestralKnowledgeCard[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const cards: OrchestralKnowledgeCard[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const text = await readFile(path.join(directory, entry.name), "utf8");
    const metadata = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
    if (!metadata) continue;
    const id = /^id:\s*([^\r\n]+)$/m.exec(metadata[1]!)?.[1]?.trim();
    const status = /^review_status:\s*([^\r\n]+)$/m.exec(metadata[1]!)?.[1]?.trim();
    if (!isOrchestralCardId(id) || status !== "reviewed") continue;
    const content = text.slice(metadata[0].length).trim();
    const title = /^#\s+([^\r\n]+)$/m.exec(content)?.[1]?.trim();
    if (!title) continue;
    if (cards.some((card) => card.id === id)) {
      throw new Error(`Duplicate orchestral knowledge card ID: ${id}`);
    }
    cards.push({
      id,
      title,
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
    });
  }
  return cards;
}

export async function listOrchestralKnowledgeCards(
  directory = path.resolve("corpus", "orchestra"),
): Promise<OrchestralCardSummary[]> {
  return (await readCards(directory)).map(({ id, title }) => ({ id, title }));
}

export async function loadOrchestralKnowledgeCard(
  id: string,
  directory = path.resolve("corpus", "orchestra"),
): Promise<OrchestralKnowledgeCard> {
  if (!isOrchestralCardId(id)) throw new Error("Invalid orchestral knowledge card ID.");
  const card = (await readCards(directory)).find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Orchestral knowledge card is unavailable: ${id}`);
  return card;
}
