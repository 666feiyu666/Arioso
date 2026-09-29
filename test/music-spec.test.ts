import { describe, expect, it } from "vitest";

import { MusicSpecSchema } from "../src/schema/music-spec.js";

const validSpec = {
  schemaVersion: "1.0",
  title: "Glass Horizon",
  intent: "A calm sunrise gradually becoming hopeful.",
  genres: ["ambient", "minimal classical"],
  moods: ["calm", "hopeful"],
  tempo: { bpm: 72, feel: "spacious and unhurried" },
  tonality: { tonic: "D", mode: "major" },
  meter: "4/4",
  instrumentation: [
    { name: "felt piano", role: "main motif", timbre: "soft, intimate, lightly mechanical" },
  ],
  structure: [
    { section: "Intro", durationSeconds: 10, direction: "Sparse piano notes emerge from silence." },
    { section: "Development", durationSeconds: 20, direction: "Warm strings widen the harmony." },
  ],
  vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
  production: "Wide stereo image, natural dynamics, restrained reverb.",
  avoid: ["heavy percussion", "vocals"],
  assumptions: ["A 30-second clip is intended."],
  lyriaPrompt: "A 30-second ambient minimal-classical instrumental in D major at 72 BPM.",
};

describe("MusicSpecSchema", () => {
  it("accepts a complete music specification", () => {
    expect(MusicSpecSchema.parse(validSpec)).toEqual(validSpec);
  });

  it("rejects a specification without a Lyria prompt", () => {
    const { lyriaPrompt: _removed, ...invalidSpec } = validSpec;
    expect(() => MusicSpecSchema.parse(invalidSpec)).toThrow();
  });
});
