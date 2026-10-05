import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { AriosoConfig } from "../config/env.js";
import { isRecord } from "../utils/validation.js";
import type { MusicTask, TaskStore } from "../web/task-store.js";
import { PRODUCTION_ARTIFACTS, isProductionRunId, type ProductionArtifact } from "./types.js";

export type PipelineCommand = (args: string[], onProgress?: (line: string) => Promise<void>) => Promise<void>;

export function pipelineCommand(config: AriosoConfig): PipelineCommand {
  const script = fileURLToPath(new URL("../../pipeline/run.py", import.meta.url));
  return async (args, onProgress) => {
    const environment: NodeJS.ProcessEnv = { ...process.env, PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" };
    delete environment.OPENAI_API_KEY;
    delete environment.GEMINI_API_KEY;
    const commandArgs = [script, ...(config.pipelineConfig ? ["--config", config.pipelineConfig] : []), ...args];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.pipelinePython ?? "python", commandArgs, {
        shell: false, windowsHide: true, env: environment, stdio: ["ignore", "pipe", "pipe"],
      });
      let tail = "";
      let progress = Promise.resolve();
      let progressError: unknown;
      const collect = (chunk: Buffer) => { tail = (tail + chunk.toString("utf8")).slice(-2000); };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        if (onProgress && line.trim()) progress = progress.then(async () => {
          if (!progressError) await onProgress(line.slice(0, 500));
        }).catch((error: unknown) => { progressError = error; child.kill(); });
      });
      child.on("error", reject);
      child.on("close", (code) => {
        void progress.then(() => {
          if (progressError) reject(progressError);
          else if (code === 0) resolve();
          else reject(new Error(`Audio pipeline failed (${code}): ${tail}`));
        }, reject);
      });
    });
  };
}

async function checksum(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function tracklistTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return hours > 0
    ? [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":")
    : [minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

export function productionArtifactPath(store: TaskStore, task: MusicTask, artifact: ProductionArtifact): string | undefined {
  const production = task.albumProduction;
  if (production?.status !== "completed" || !isProductionRunId(production.runId)) return undefined;
  const directory = path.join(store.taskDirectory(task), "production", production.runId);
  const current = path.join(directory, PRODUCTION_ARTIFACTS[artifact]);
  // Keep completed runs from the previous result/ layout readable.
  return existsSync(current) ? current : path.join(directory, "result", PRODUCTION_ARTIFACTS[artifact]);
}

export async function verifyProductionResult(
  output: string, sources: Array<{ file: string; hash: string }>,
): Promise<number> {
  const value: unknown = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
  if (!isRecord(value) || value.denoiser !== "denoising-historical-recordings"
    || value.source_unchanged !== true || !Array.isArray(value.tracks) || value.tracks.length !== sources.length
    || !isRecord(value.audio) || !isRecord(value.audio.pcm)) throw new Error("Incomplete production manifest.");
  const pcm = value.audio.pcm;
  if (pcm.channels !== 1 || pcm.sample_rate !== 44100 || pcm.bits_per_sample !== 24
    || typeof pcm.duration_seconds !== "number" || !Number.isFinite(pcm.duration_seconds) || pcm.duration_seconds <= 0) {
    throw new Error("Unexpected album master format or duration.");
  }
  let duration = 0;
  const tracklist: string[] = [];
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;
    const track: unknown = value.tracks[index];
    const cleaned = path.join(output, "tracks", String(index + 1).padStart(2, "0"), "audio-denoised.wav");
    if (!isRecord(track) || track.position !== index + 1 || track.track_number !== index + 1
      || typeof track.title !== "string" || !track.title.trim() || /[\r\n]/u.test(track.title)
      || typeof track.start_seconds !== "number" || Math.abs(track.start_seconds - duration) >= 0.002
      || track.source_sha256 !== source.hash || typeof track.duration_seconds !== "number"
      || !Number.isFinite(track.duration_seconds) || track.duration_seconds <= 0
      || track.sha256 !== await checksum(cleaned) || source.hash !== await checksum(source.file)) {
      throw new Error(`Production verification failed for track ${index + 1}.`);
    }
    tracklist.push(`${tracklistTimestamp(track.start_seconds)} ${track.title}`);
    duration += track.duration_seconds;
  }
  if (Math.abs(duration - pcm.duration_seconds) >= 0.002
    || value.audio.sha256 !== await checksum(path.join(output, "album-denoised.wav"))) {
    throw new Error("Album master checksum or duration verification failed.");
  }
  for (const name of Object.values(PRODUCTION_ARTIFACTS)) {
    if ((await stat(path.join(output, name))).size === 0) throw new Error(`Empty production artifact: ${name}`);
  }
  if (await readFile(path.join(output, "tracklist.txt"), "utf8") !== `${tracklist.join("\n\n")}\n`) {
    throw new Error("Production tracklist does not use the expected chapter format.");
  }
  return pcm.duration_seconds;
}

export async function produceAlbum(
  store: TaskStore, task: MusicTask, command: PipelineCommand,
  onProgress: (line: string) => Promise<void>,
): Promise<{ runId: string; trackIds: string[]; durationSeconds: number }> {
  const tracks = [...(task.albumTracks ?? [])].filter((track) => track.admission !== "excluded")
    .sort((a, b) => a.order - b.order);
  if (!tracks.length || tracks.some((track) => track.status !== "completed" || !track.audioFile)) {
    throw new Error("Every production candidate must have completed audio.");
  }
  const runId = randomUUID();
  const productionDirectory = path.join(store.taskDirectory(task), "production");
  const output = path.join(productionDirectory, runId);
  const input = path.join(productionDirectory, `.${runId}.sources.json`);
  const cover = path.join(productionDirectory, `.${runId}.background.ppm`);
  await mkdir(productionDirectory, { recursive: true });
  const sources: Array<{ file: string; hash: string }> = [];
  for (const track of tracks) {
    const file = store.albumTrackAudioPath(task, track);
    if (!file || path.extname(file).toLowerCase() !== ".mp3") throw new Error("Production requires safe MP3 sources.");
    const hash = await checksum(file);
    sources.push({ file, hash });
  }
  try {
    // A plain PPM background satisfies the existing album pipeline's cover input.
    await writeFile(cover, "P3\n2 2\n255\n24 27 32 24 27 32\n24 27 32 24 27 32\n", { flag: "wx" });
    await writeFile(input, JSON.stringify(tracks.map((track, index) => ({
      trackId: track.id, title: track.title, ...sources[index],
    })), null, 2), { flag: "wx" });
    await store.update(task.id, { albumProduction: { ...task.albumProduction!, runId, trackIds: tracks.map((track) => track.id) } });
    await command(["album", input, "--title", task.title || "Background Music Album", "--cover", cover,
      "--workers", "2", "--output-dir", output], onProgress);
    const durationSeconds = await verifyProductionResult(output, sources);
    return { runId, trackIds: tracks.map((track) => track.id), durationSeconds };
  } finally {
    await Promise.all([rm(input, { force: true }), rm(cover, { force: true })]);
  }
}
