import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  listOrchestralKnowledgeCards,
  loadOrchestralKnowledgeCard,
} from "../src/retrieval/orchestral-cards.js";

describe("orchestral knowledge cards", () => {
  it("offers only reviewed cards and preserves both descriptions in the snapshot", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-cards-"));
    const content = "# A musical journey\r\n\r\n## Musical description\r\nHorn calls return in the finale.\r\n\r\n## Imaginative description\r\nA distant landscape becomes an intimate memory.";
    try {
      await writeFile(path.join(directory, "reference.md"),
        `---\r\nid: journey\r\nreview_status: reviewed\r\n---\r\n\r\n${content}\r\n`);
      await writeFile(path.join(directory, "draft.md"),
        "---\nid: draft\nreview_status: draft\n---\n# Unreviewed work\n");
      expect(await listOrchestralKnowledgeCards(directory)).toEqual([
        { id: "journey", title: "A musical journey" },
      ]);
      const snapshot = await loadOrchestralKnowledgeCard("journey", directory);
      expect(snapshot.content).toBe(content);
      expect(snapshot.contentHash).toBe(createHash("sha256").update(content).digest("hex"));
      await writeFile(path.join(directory, "reference.md"),
        "---\nid: journey\nreview_status: reviewed\n---\n# Changed work\n");
      expect((await loadOrchestralKnowledgeCard("journey", directory)).contentHash)
        .not.toBe(snapshot.contentHash);
      expect(snapshot.content).toBe(content);
      await expect(loadOrchestralKnowledgeCard("draft", directory)).rejects.toThrow("unavailable");
      await expect(loadOrchestralKnowledgeCard("../reference", directory)).rejects.toThrow("Invalid");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("allows the no-reference workflow when the card directory is absent", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-missing-cards-"));
    try {
      expect(await listOrchestralKnowledgeCards(path.join(directory, "missing"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
