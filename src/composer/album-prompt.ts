import type { AlbumPlan } from "../schema/album-plan.js";
import { MusicSpecSchema, type MusicSpec } from "../schema/music-spec.js";

export const ALBUM_PROMPT_FORMAT = "album-v1";

const PLANNING_DEPENDENCY = /\b(?:previous|preceding|next|earlier|other)\s+(?:track|movement|candidate)s?\b|\b(?:album outline|shared contract|candidate\s*#?\s*\d+)\b|\b(?:across|between|among)\s+(?:the\s+)?(?:tracks|candidates)\b|\b(?:as above|as before)\b/i;
const LEGACY_BATCH_DIRECTION = /^Vary foreground instrument, ensemble size, room intimacy, groove density, and harmonic rhythm\b/i;

/** Legacy experiment contracts may mix audible common directions and batch planning. */
export function renderAlbumSharedDirections(plan: AlbumPlan): string {
  return plan.sharedSoundContract.trim().split(/(?<=[.!?])\s+|\n+/u)
    .filter((sentence) => !LEGACY_BATCH_DIRECTION.test(sentence) && !PLANNING_DEPENDENCY.test(sentence))
    .join(" ");
}

export function validateAlbumMusicSpec(spec: MusicSpec): void {
  MusicSpecSchema.parse(spec);
  if (spec.vocals.enabled || [spec.vocals.language, spec.vocals.style, spec.vocals.lyricalTheme].some((value) => value !== null)) {
    throw new Error("Album candidates must be instrumental with no vocal fields.");
  }
  const musicalFields = [
    ...spec.genres, ...spec.moods, spec.tempo.feel, spec.tonality.mode ?? "", spec.production,
    ...spec.instrumentation.flatMap((instrument) => [instrument.name, instrument.role, instrument.timbre]),
    ...spec.structure.map((section) => section.direction), ...spec.avoid,
  ];
  if (musicalFields.some((field) => PLANNING_DEPENDENCY.test(field))) {
    throw new Error("Album musical fields must be standalone directions without batch planning dependencies.");
  }
  if (spec.instrumentation.some((instrument) => /\bhollow[- ]body\s+piano\b/i.test(instrument.name))) {
    throw new Error("Use an accurate instrument name: hollow-body describes a guitar, not a piano.");
  }
}

/** Render only musical fields; generated prose, album strategy and assumptions stay in composer context. */
export function buildAlbumLyriaPrompt(plan: AlbumPlan, number: number, spec: MusicSpec): string {
  const track = plan.tracks.find((candidate) => candidate.number === number);
  if (!track) throw new Error(`Unknown album candidate: ${number}`);
  validateAlbumMusicSpec(spec);
  const tonality = [spec.tonality.tonic, spec.tonality.mode].filter(Boolean).join("; ");
  const rhythm = [spec.tempo.bpm === null ? "" : `${spec.tempo.bpm} BPM`, spec.tempo.feel, spec.meter ? `${spec.meter} meter` : ""].filter(Boolean).join("; ");
  const identity = [spec.genres.join(", "), spec.moods.join(", ")].filter(Boolean).join(". ");
  const instruments = spec.instrumentation.map((instrument) => `${instrument.name}: ${instrument.role}${instrument.timbre ? ` Tone: ${instrument.timbre}` : ""}`).join("\n");
  const structure = spec.structure.map((section) => `[${section.section}]${section.durationSeconds === null ? "" : ` Approximately ${section.durationSeconds}s.`} ${section.direction}`).join("\n");
  return [
    "Instrumental only, no vocals.",
    `Aim for approximately ${track.targetSeconds} seconds, with a self-contained beginning, development and ending.`,
    renderAlbumSharedDirections(plan),
    identity,
    rhythm ? `Rhythm: ${rhythm}.` : "",
    tonality ? `Harmony: ${tonality}.` : "",
    instruments ? `Instrumentation and interaction:\n${instruments}` : "",
    structure ? `Development:\n${structure}` : "",
    spec.production ? `Production: ${spec.production}` : "",
    spec.avoid.length ? `Avoid: ${spec.avoid.join("; ")}.` : "",
  ].filter(Boolean).join("\n\n");
}
