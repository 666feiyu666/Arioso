import { describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

describe("web capabilities API", () => {
  it("advertises music routing and the complete-work duration limit", async () => {
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
          types: ["jazz", "blues", "electronic", "instrumental-rock", "instrumental-hip-hop"],
          available: ["jazz"],
          availability: expect.objectContaining({
            jazz: { available: true, styles: true, standards: true },
            blues: expect.objectContaining({ available: false }),
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
