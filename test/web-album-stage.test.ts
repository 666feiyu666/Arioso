import { describe, expect, it } from "vitest";

// The album stage is a browser-only ES module; it is imported here as plain
// text-rendering code, without a DOM, to pin down what it prints.
// @ts-expect-error -- the shared page module ships without type declarations.
import { createAlbumStage } from "../web/album-view.js";

function makeStage(task: Record<string, unknown>) {
  let current = task;
  const stage = createAlbumStage({
    language: () => "en",
    api: async () => ({}),
    getTask: () => current,
    setTask: (updated: Record<string, unknown>) => { current = updated; },
    rerender: () => {},
    approve: async () => {},
    revise: async () => {},
    onRunning: () => {},
  });
  return { stage, setTask: (updated: Record<string, unknown>) => { current = updated; } };
}

const track = (order: number, status: string, audioFile?: string) => ({
  id: `track-${order}`,
  order,
  title: `Track ${order}`,
  targetDurationSeconds: 150,
  admission: "candidate",
  status,
  ...(audioFile ? { audioFile, durationSeconds: 150 } : {}),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("album stage rendering", () => {
  it("draws one progress card while the album is running", () => {
    const { stage } = makeStage({
      id: "album-1",
      status: "composing",
      albumCandidateCount: 2,
      albumPlaylist: [],
      albumTracks: [track(1, "composing"), track(2, "queued")],
    });

    const html = stage.render();

    expect(count(html, 'class="pl-progress-card"')).toBe(1);
  });

  it("offers the start action at the top of the plan and again at its end", () => {
    const { stage } = makeStage({
      id: "album-2",
      status: "review",
      albumCandidateCount: 1,
      albumPlaylist: [],
      albumPlan: {
        albumTitle: "A Plan",
        albumMind: "One idea.",
        cohesionStrategy: "Stay close.",
        sharedSoundContract: "Instrumental only.",
        tracks: [{ number: 1, title: "Track 1", targetSeconds: 150, musicalRole: "Opening",
          instruments: ["Piano"], groove: "Slow", harmony: "Minor", development: "Grows" }],
      },
      playlistBriefing: { intentReading: "Quiet music.", referenceReadings: [] },
      playlistDiscussion: [],
      albumTracks: [track(1, "queued")],
    });

    const html = stage.render();
    const buttons = count(html, 'data-album-action="approve"');

    expect(buttons).toBe(2);
    // The first start button sits in the plan header, before the track plans.
    expect(html.indexOf('data-album-action="approve"')).toBeLessThan(html.indexOf("pl-outlines"));
  });
});
