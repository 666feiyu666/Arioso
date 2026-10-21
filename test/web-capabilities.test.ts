import { describe, expect, it } from "vitest";

import { MUSIC_TYPES, loadMusicRetriever } from "../src/retrieval/music-retriever.js";
import { withWebServer } from "./helpers/web-server.js";

describe("web capabilities API", () => {
  it("advertises music routing and the complete-work duration limit", async () => {
    // Which corpora are installed varies by checkout, so the expected
    // availability comes from the retriever rather than from the disk state.
    const { retriever } = await loadMusicRetriever();
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/capabilities`);
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({
        apiVersion: 11,
        version: expect.any(String),
        workflows: ["01-general", "02-music", "03-orchestral", "04-album", "05-playlist"],
        discussionSessions: true,
        creativeSessionTimeline: true,
        discussionImages: {
          types: ["image/jpeg", "image/png", "image/webp"],
          maximumBytes: 8 * 1024 * 1024,
        },
        discussionMood: true,
        moodEntries: true,
        albumPlaylist: true,
        albumExport: true,
        backgroundMusicProducer: { denoiser: "denoising-historical-recordings", outputChannels: 1, listeningReview: "required" },
        albumCandidates: { minimum: 12, maximum: 28, default: 14 },
        musicCorpus: {
          types: [...MUSIC_TYPES],
          available: retriever.availableTypes(),
          availability: expect.objectContaining({
            // The shipped Jazz corpus is the one this repository guarantees.
            jazz: { available: true, styles: true, standards: true },
          }),
        },
        playlistReferences: true,
        playlistPlanConfirmation: true,
        orchestralAssembly: true,
        orchestralPromptFormat: "orchestral-v1",
        orchestralDuration: {
          minimumTotalMinutes: 5,
          maximumTotalMinutes: 12,
          maximumMovementMinutes: 3,
        },
      });
    });
  });
});
