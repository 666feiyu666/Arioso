import { z } from "zod";

export const MusicSectionSchema = z.object({
  section: z.string().describe("A conventional section label such as Intro, Verse, Chorus, Bridge, or Outro."),
  durationSeconds: z.number().int().positive().nullable().describe("Approximate section duration, or null when timing is intentionally flexible."),
  direction: z.string().describe("Instrumentation, energy, harmony, and transition directions for this section."),
});

export const InstrumentSchema = z.object({
  name: z.string().describe("Instrument or sound source."),
  role: z.string().describe("The musical function of the instrument in the arrangement."),
  timbre: z.string().describe("A concise description of its tone, articulation, or processing."),
});

export const MusicSpecSchema = z.object({
  schemaVersion: z.literal("1.0"),
  title: z.string().describe("A short working title for the generated piece."),
  intent: z.string().describe("The scene, story, or creative purpose of the music."),
  genres: z.array(z.string()).describe("Genre and subgenre descriptors, ordered by importance."),
  moods: z.array(z.string()).describe("Emotional qualities and their intended progression."),
  tempo: z.object({
    bpm: z.number().int().positive().nullable().describe("Target BPM, or null when a precise tempo would be artificial."),
    feel: z.string().describe("Rhythmic feel, groove, swing, or pacing."),
  }),
  tonality: z.object({
    tonic: z.string().nullable().describe("Tonic pitch such as C, F-sharp, or null when unspecified."),
    mode: z.string().nullable().describe("Mode or tonal language, or null when unspecified."),
  }),
  meter: z.string().nullable().describe("Meter such as 4/4, 6/8, free time, or null when unspecified."),
  instrumentation: z.array(InstrumentSchema),
  structure: z.array(MusicSectionSchema),
  vocals: z.object({
    enabled: z.boolean(),
    language: z.string().nullable().describe("Requested lyric language, or null for instrumental music."),
    style: z.string().nullable().describe("Vocal delivery described through musical traits, never artist imitation."),
    lyricalTheme: z.string().nullable().describe("Original lyrical subject and imagery, or null when vocals are disabled."),
  }),
  production: z.string().describe("Mix, spatial, dynamics, texture, and recording aesthetics."),
  avoid: z.array(z.string()).describe("Musical or production elements that should not appear."),
  assumptions: z.array(z.string()).describe("Concise creative decisions introduced because the request was underspecified."),
  lyriaPrompt: z.string().describe("A standalone, production-ready prompt for Google Lyria."),
});

export type MusicSpec = z.infer<typeof MusicSpecSchema>;
