import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildReviewRequestText, type MusicReviewInput } from "../src/moodmic/music-review.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock, reviewMock } = vi.hoisted(() => ({ generateMock: vi.fn(), reviewMock: vi.fn() }));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/moodmic/music-review.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/moodmic/music-review.js")>();
  return { ...actual, GeminiMusicReviewer: class { review = reviewMock; } };
});

const environment = { OPENAI_API_KEY: "test-openai", GEMINI_API_KEY: "test-gemini" };
const chatId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({
    audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null,
  });
  reviewMock.mockReset().mockResolvedValue({
    verdict: "match", summary: "Matches the request.", matchedPoints: [], mismatchedPoints: [],
  });
});

function musicSpec(title: string, lyriaPrompt: string) {
  return {
    schemaVersion: "1.0", title, intent: "A quiet night piece.",
    genres: ["ambient"], moods: ["calm"],
    tempo: { bpm: 60, feel: "slow" }, tonality: { tonic: "C", mode: "major" }, meter: "4/4",
    instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
    structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "spacious", avoid: [], assumptions: [],
    lyriaPrompt,
  };
}

const originalPrompt = "slow calm ambient piano, instrumental only, no vocals";
const editedPrompt = "fast aggressive distorted electric guitar, loud drums, instrumental only";

function reviewInput(): MusicReviewInput {
  return {
    audio: Buffer.from([1, 2, 3]),
    description: "A calm slow ambient piano piece",
    spec: musicSpec("Calm piece", originalPrompt) as never,
  };
}

describe("reviewer request text", () => {
  it("quotes the confirmed request after the earlier context", () => {
    const text = buildReviewRequestText({ ...reviewInput(), confirmedPrompt: editedPrompt });
    expect(text).toContain("A calm slow ambient piano piece");
    expect(text).toContain("Confirmed generation request");
    expect(text).toContain(editedPrompt);
    // The confirmed request is stated to win over the earlier description.
    expect(text.indexOf(editedPrompt)).toBeGreaterThan(text.indexOf("Composed specification"));
    // Reviewer instructions stay outside the quoted request.
    expect(text).not.toContain("You are Arioso's music generation reviewer");
  });

  it("omits an unconfirmed prompt so the earlier request is judged alone", () => {
    const text = buildReviewRequestText(reviewInput());
    expect(text).not.toContain("Confirmed generation request");
    expect(text).toContain("Composed specification");
  });
});

describe("confirmed prompt reaches generation and review", () => {
  it("reviews against the edited prompt the user confirmed", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const approved = await fetch(`${baseUrl}/api/tasks/planning-task/prompt/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editedPrompt }),
      });
      expect(approved.status).toBe(202);
      for (let attempt = 0; attempt < 120 && reviewMock.mock.calls.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(reviewMock).toHaveBeenCalledTimes(1);
      // Generation received the edit, and so did the review.
      expect(generateMock.mock.calls[0]?.[0]).toBe(editedPrompt);
      const input = reviewMock.mock.calls[0]?.[0] as MusicReviewInput;
      expect(input.confirmedPrompt).toBe(editedPrompt);
      expect(input.spec?.lyriaPrompt).toBe(editedPrompt);
      expect(input.description).toBe("A calm slow ambient piano piece");
    }, {
      environment,
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "tasks", "01-general", "planning-task");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "task.json"), JSON.stringify({
          id: "planning-task", description: "A calm slow ambient piano piece", title: "Calm piece",
          mode: "generate", status: "planning", workflowType: "01-general",
          moodChatId: chatId, composerModel: "test", lyriaModel: "lyria-3.5",
          updatedAt: "2026-01-02T00:00:00.000Z",
          musicSpec: musicSpec("Calm piece", originalPrompt),
        }));
      },
    });
  });
});
