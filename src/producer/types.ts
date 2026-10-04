export interface AlbumProduction {
  role: "background_music_producer";
  status: "pending" | "checking" | "composing" | "processing" | "completed" | "failed";
  stage: "runtime" | "composition" | "postproduction" | "delivery";
  listeningReview: "pending";
  message?: string;
  error?: string | undefined;
  runId?: string;
  trackIds?: string[];
  durationSeconds?: number;
}

export const PRODUCTION_ARTIFACTS = {
  audio: "album-denoised.wav",
  video: "video.mp4",
  tracklist: "tracklist.txt",
  manifest: "manifest.json",
} as const;

export type ProductionArtifact = keyof typeof PRODUCTION_ARTIFACTS;

export function isProductionRunId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/u.test(value);
}
