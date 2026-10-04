import { AlbumPlanSchema, type AlbumReview } from "../src/schema/album-plan.js";
import type { MusicSpec } from "../src/schema/music-spec.js";

export function albumPlanFixture() {
  return AlbumPlanSchema.parse({
    albumTitle: "Night Windows",
    albumMind: "Unhurried nocturnal conversations that settle through generous silence.",
    cohesionStrategy: "Piano-centered pieces and bass-led duos form related groups; room perspectives vary with ensemble size.",
    sharedSoundContract: "Instrumental only, no vocals. Spacious phrasing and gently ambiguous harmony. Vary foreground instrument, ensemble size, room intimacy, groove density, and harmonic rhythm, but avoid cinematic bombast.",
    tracks: Array.from({ length: 14 }, (_, index) => ({
      number: index + 1,
      title: `Night ${index + 1}`,
      musicalRole: index % 2 ? "Bass-led conversation" : "Piano motif and sparse replies",
      instruments: index % 2 ? ["upright bass", "brush kit"] : ["piano", "upright bass"],
      groove: "Unhurried pulse with generous rests",
      harmony: "Slow minor ninths with suspended color",
      development: "Introduce a gesture, exchange fragments, soften to a complete close",
      targetSeconds: [120, 150, 180][index % 3],
    })),
  });
}

export function albumSpecFixture(): MusicSpec {
  return {
    schemaVersion: "1.0",
    title: "Windowlight",
    intent: "A nocturnal jazz conversation",
    genres: ["jazz"],
    moods: ["relaxed", "shadowed"],
    tempo: { bpm: null, feel: "Slow swing with spacious rests" },
    tonality: { tonic: null, mode: "Ambiguous minor ninths" },
    meter: "4/4",
    instrumentation: [
      { name: "piano", role: "States a low motif and answers the bass", timbre: "Soft acoustic tone" },
      { name: "upright bass", role: "Anchors pauses and exchanges sparse fragments", timbre: "Round plucked tone" },
    ],
    structure: [
      { section: "Opening", durationSeconds: 30, direction: "Piano reveals a compact low motif" },
      { section: "Conversation", durationSeconds: 60, direction: "Vary the piano motif in the middle. Alternate bass and piano responses." },
      { section: "Ending", durationSeconds: 30, direction: "Thin to a quiet independent cadence" },
    ],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "Warm acoustic sound with gentle natural decay",
    avoid: ["vocals", "abrupt drops"],
    assumptions: ["These are internal creative decisions"],
    lyriaPrompt: "Do not copy this prose or batch planning into the rendered prompt.",
  };
}

export function albumReviewFixture(): AlbumReview {
  return {
    verdict: "ready", albumFindings: [], similarities: [],
    candidates: Array.from({ length: 14 }, (_, index) => ({
      number: index + 1, verdict: "ready", evidence: ["Spacious rests and a quiet independent cadence"], revisionBrief: null,
    })),
  };
}
