import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runBackgroundMusicProducer } from "../src/producer/background-music-producer.js";
import { productionArtifactPath, type PipelineCommand } from "../src/producer/pipeline.js";
import { runAlbumTask } from "../src/web/server.js";
import { parseTaskInput, TaskStore } from "../src/web/task-store.js";
import { albumPlanFixture, albumReviewFixture, albumSpecFixture } from "./album-fixtures.js";
import { withWebServer } from "./helpers/web-server.js";

const mocks = vi.hoisted(() => ({ plan: vi.fn(), compose: vi.fn(), review: vi.fn(), generate: vi.fn() }));
vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: mocks.plan, composeAlbumTrack: mocks.compose,
  reviewAlbumCandidates: mocks.review, reviseAlbumTrack: vi.fn(),
}));
vi.mock("../src/lyria/lyria-client.js", () => ({ LyriaClient: class { generate = mocks.generate; } }));

const config = { openAiApiKey: "test", openAiModel: "test", geminiApiKey: "test", lyriaModel: "lyria-3.5", outputDirectory: "unused" };
const roots: string[] = [];
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.plan.mockResolvedValue(albumPlanFixture());
  mocks.compose.mockResolvedValue(albumSpecFixture());
  mocks.review.mockResolvedValue(albumReviewFixture());
  mocks.generate.mockResolvedValue({ audio: Buffer.from("original-mp3"), generatedText: null });
});
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith("arioso-producer-")) {
      throw new Error("Unsafe temporary cleanup path.");
    }
    await rm(root, { recursive: true, force: true });
  }
});

async function setup(options: { cover?: boolean } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-producer-"));
  roots.push(root);
  const store = new TaskStore(path.join(root, "outputs", "tasks"));
  await store.initialize();
  const task = await store.create(parseTaskInput({ description: "Background music for reading", workflowType: "04-album", produceAlbum: true }), config);
  if (options.cover !== false) await writeFile(path.join(store.taskDirectory(task), "cover.png"), "cover");
  return { store, task, root, compose: () => runAlbumTask(store, store.get(task.id)!, config) };
}

async function fakeAlbumOutput(args: string[], progress?: (line: string) => Promise<void>): Promise<void> {
  const input = args[1]!;
  const output = args[args.indexOf("--output-dir") + 1]!;
  const sources = JSON.parse(await readFile(input, "utf8")) as Array<{ file: string; hash: string }>;
  await mkdir(output, { recursive: true });
  const master = Buffer.from("joined-wav");
  const tracks = [];
  for (const [index, source] of sources.entries()) {
    const cleaned = Buffer.from(`cleaned-${index}`);
    const directory = path.join(output, "tracks", String(index + 1).padStart(2, "0"));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "audio-denoised.wav"), cleaned);
    tracks.push({ position: index + 1, track_number: index + 1, title: `Track ${index + 1}`, start_seconds: index,
      source_sha256: hash(await readFile(source.file)), sha256: hash(cleaned), duration_seconds: 1 });
  }
  await writeFile(path.join(output, "album-denoised.wav"), master);
  const videoCreated = args.includes("--cover");
  if (videoCreated) await writeFile(path.join(output, "video.mp4"), "video");
  await writeFile(path.join(output, "tracklist.txt"), tracks.map((track) => `00:${String(track.start_seconds).padStart(2, "0")} ${track.title}`).join("\n\n") + "\n");
  await writeFile(path.join(output, "manifest.json"), JSON.stringify({
    denoiser: "denoising-historical-recordings", source_unchanged: true, tracks,
    mp4: videoCreated ? { output: path.join(output, "video.mp4") } : null,
    audio: { sha256: hash(master), pcm: { sample_rate: 44100, channels: 1, bits_per_sample: 24, duration_seconds: sources.length } },
  }));
  await progress?.("Album exports complete");
}

function fakeCommand() {
  return vi.fn<PipelineCommand>(async (args, progress) => {
    if (args[0] === "album") await fakeAlbumOutput(args, progress);
  });
}

describe("Background Music Producer lifecycle", () => {
  it("runs planning, prompt review, generation and verified postproduction without admitting candidates", async () => {
    const { store, task, compose } = await setup();
    const command = fakeCommand();
    await runBackgroundMusicProducer(store, task, config, compose, command);
    const completed = store.get(task.id)!;
    expect(command.mock.calls.map(([args]) => args[0])).toEqual(["doctor", "album"]);
    expect(mocks.plan).toHaveBeenCalledOnce();
    expect(mocks.compose).toHaveBeenCalledTimes(14);
    expect(mocks.review).toHaveBeenCalledTimes(2);
    expect(mocks.generate).toHaveBeenCalledTimes(14);
    expect(completed).toMatchObject({ status: "completed", albumPlaylist: [], albumProduction: {
      role: "background_music_producer", status: "completed", stage: "delivery", listeningReview: "pending", durationSeconds: 14,
      videoCreated: true,
    } });
    expect(command.mock.calls[1]?.[0]).toContain("--cover");
    expect(completed.albumTracks!.every((track) => track.admission === "candidate")).toBe(true);
    expect(await readFile(productionArtifactPath(store, completed, "audio")!, "utf8")).toBe("joined-wav");
    expect(await readFile(store.albumTrackAudioPath(completed, completed.albumTracks![0]!)!, "utf8")).toBe("original-mp3");
    const productionDirectory = path.join(store.taskDirectory(completed), "production");
    expect(await readdir(productionDirectory)).toEqual([completed.albumProduction!.runId]);
    expect(await readdir(path.join(productionDirectory, completed.albumProduction!.runId!))).not.toContain("result");
    expect(await readFile(productionArtifactPath(store, completed, "tracklist")!, "utf8"))
      .toMatch(/^00:00 Track 1\n\n00:01 Track 2/u);
    // Re-entering a completed workflow must not call models or process again.
    await runBackgroundMusicProducer(store, completed, config, compose, command);
    expect(command).toHaveBeenCalledTimes(2);
    expect(mocks.generate).toHaveBeenCalledTimes(14);
  });

  it("completes denoising without creating an MP4 when cover.png is absent", async () => {
    const { store, task, compose } = await setup({ cover: false });
    const command = fakeCommand();
    await runBackgroundMusicProducer(store, task, config, compose, command);
    const completed = store.get(task.id)!;
    expect(command.mock.calls[1]?.[0]).not.toContain("--cover");
    expect(completed).toMatchObject({ status: "completed", albumProduction: {
      status: "completed", videoCreated: false,
      message: "Denoised audio exports verified. MP4 skipped because cover.png was not provided.",
    } });
    expect(productionArtifactPath(store, completed, "audio")).toBeDefined();
    expect(productionArtifactPath(store, completed, "video")).toBeUndefined();
  });

  it("persists structured per-track denoising progress for the interface", async () => {
    const { store, task, compose, root } = await setup();
    const observed: unknown[] = [];
    const command: PipelineCommand = async (args, progress) => {
      if (args[0] !== "album") return;
      for (const line of ["Checking 14 track checkpoint(s)", "[03/14] Decoding Green Notebook",
        "[07/14 complete] Track 07: Small Clear Steps", "Applying one album gain to every track: 0.000000 dB",
        "Concatenating PCM tracks in the requested order without added gaps", "Creating 1080p H.264 / AAC MP4..."]) {
        await progress?.(line);
        observed.push(structuredClone(store.get(task.id)?.albumProduction?.progress));
      }
      await fakeAlbumOutput(args);
    };
    await runBackgroundMusicProducer(store, task, config, compose, command);
    expect(observed).toEqual([
      { step: "checking", completedTracks: 0, totalTracks: 14 },
      { step: "denoising", completedTracks: 0, totalTracks: 14, currentTrackNumber: 3, currentTrackTitle: "Green Notebook" },
      { step: "denoising", completedTracks: 7, totalTracks: 14, currentTrackNumber: 7, currentTrackTitle: "Small Clear Steps" },
      { step: "exporting", completedTracks: 14, totalTracks: 14 },
      { step: "assembling", completedTracks: 14, totalTracks: 14 },
      { step: "video", completedTracks: 14, totalTracks: 14 },
    ]);
    const restarted = new TaskStore(path.join(root, "outputs", "tasks"));
    await restarted.initialize();
    expect(restarted.get(task.id)?.albumProduction?.progress)
      .toEqual({ step: "video", completedTracks: 14, totalTracks: 14 });
  });

  it("fails runtime preflight before any model call", async () => {
    const { store, task, compose } = await setup();
    const command = vi.fn<PipelineCommand>().mockRejectedValue(new Error("Runtime unavailable"));
    await expect(runBackgroundMusicProducer(store, task, config, compose, command)).rejects.toThrow("Runtime unavailable");
    expect(mocks.plan).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(store.get(task.id)).toMatchObject({ status: "failed", albumProduction: { stage: "runtime", status: "failed" } });
  });

  it("does not postprocess an album with a failed generation candidate", async () => {
    const { store, task, compose } = await setup();
    mocks.generate.mockRejectedValueOnce(new Error("Generation rejected"));
    const command = fakeCommand();
    await expect(runBackgroundMusicProducer(store, task, config, compose, command)).rejects.toThrow("Generation rejected");
    expect(command.mock.calls.map(([args]) => args[0])).toEqual(["doctor"]);
    expect(store.get(task.id)?.albumTracks?.filter((track) => track.status === "completed")).toHaveLength(13);
    await runBackgroundMusicProducer(store, store.get(task.id)!, config, compose, command);
    expect(mocks.generate).toHaveBeenCalledTimes(15);
    expect(store.get(task.id)?.status).toBe("completed");
  });

  it("retries failed processing with existing audio after a server restart", async () => {
    const { store, task, compose, root } = await setup();
    const command = fakeCommand();
    command.mockImplementationOnce(async () => {}).mockImplementationOnce(async (args) => {
      const output = args[args.indexOf("--output-dir") + 1]!;
      await mkdir(output, { recursive: true });
      await writeFile(path.join(output, "run-state.json"), "{}");
      throw new Error("Denoising interrupted");
    });
    await expect(runBackgroundMusicProducer(store, task, config, compose, command)).rejects.toThrow("Denoising interrupted");
    const firstRun = store.get(task.id)!.albumProduction!.runId;
    expect(store.get(task.id)).toMatchObject({ status: "failed", albumProduction: { stage: "postproduction" } });
    const resumedStore = new TaskStore(path.join(root, "outputs", "tasks"));
    await resumedStore.initialize();
    const resumed = resumedStore.get(task.id)!;
    await runBackgroundMusicProducer(resumedStore, resumed, config,
      () => runAlbumTask(resumedStore, resumedStore.get(task.id)!, config), command);
    expect(resumedStore.get(task.id)?.status).toBe("completed");
    expect(resumedStore.get(task.id)?.albumProduction?.runId).toBe(firstRun);
    expect(command.mock.calls[3]?.[0]).toContain("--resume");
    expect(mocks.generate).toHaveBeenCalledTimes(14);
    expect(mocks.plan).toHaveBeenCalledOnce();
  });

  it("starts a new production run when a generated source changed after failure", async () => {
    const { store, task, compose } = await setup();
    const command = fakeCommand();
    command.mockImplementationOnce(async () => {}).mockImplementationOnce(async () => {
      throw new Error("Denoising interrupted");
    });
    await expect(runBackgroundMusicProducer(store, task, config, compose, command)).rejects.toThrow("Denoising interrupted");
    const failed = store.get(task.id)!;
    const firstRun = failed.albumProduction!.runId;
    await writeFile(store.albumTrackAudioPath(failed, failed.albumTracks![0]!)!, "changed-source");
    await runBackgroundMusicProducer(store, store.get(task.id)!, config, compose, command);
    expect(store.get(task.id)?.albumProduction?.runId).not.toBe(firstRun);
    expect(command.mock.calls[3]?.[0]).not.toContain("--resume");
  });

  it("marks interrupted production failed while preserving completed candidates", async () => {
    const { store, task, compose, root } = await setup();
    await compose();
    await store.update(task.id, { status: "processing", albumProduction: {
      ...store.get(task.id)!.albumProduction!, status: "processing", stage: "postproduction",
    } });
    const restarted = new TaskStore(path.join(root, "outputs", "tasks"));
    await restarted.initialize();
    expect(restarted.get(task.id)).toMatchObject({ status: "failed", albumProduction: { status: "failed", stage: "postproduction" } });
    expect(restarted.get(task.id)?.albumTracks?.every((track) => track.status === "completed" && track.audioFile)).toBe(true);
  });

  it("rejects altered cleaned output instead of reporting completion", async () => {
    const { store, task, compose } = await setup();
    const command: PipelineCommand = async (args, progress) => {
      if (args[0] !== "album") return;
      await fakeAlbumOutput(args, progress);
      await writeFile(path.join(args[args.indexOf("--output-dir") + 1]!, "album-denoised.wav"), "corrupt");
    };
    await expect(runBackgroundMusicProducer(store, task, config, compose, command)).rejects.toThrow("checksum");
    expect(store.get(task.id)?.status).toBe("failed");
    expect(productionArtifactPath(store, store.get(task.id)!, "audio")).toBeUndefined();
  });

  it("serves completed artifacts with correct MIME types and byte ranges", async () => {
    const { store, task, compose } = await setup();
    await runBackgroundMusicProducer(store, task, config, compose, fakeCommand());
    const completed = store.get(task.id)!;
    await withWebServer(async ({ baseUrl }) => {
      const base = `${baseUrl}/api/tasks/${task.id}/production/`;
      const audio = await fetch(base + "audio", { headers: { Range: "bytes=0-5" } });
      expect(audio.status).toBe(206);
      expect(audio.headers.get("content-type")).toBe("audio/wav");
      expect(await audio.text()).toBe("joined");
      expect((await fetch(base + "video", { method: "HEAD" })).headers.get("content-type")).toBe("video/mp4");
      expect((await fetch(base + "tracklist")).headers.get("content-type")).toContain("text/plain");
      expect((await fetch(base + "manifest")).headers.get("content-type")).toBe("application/json");
      expect((await fetch(base + "inputs")).status).toBe(404);
    }, { prepare: async (serverRoot) => {
      const destination = path.join(serverRoot, "outputs", "tasks", "04-album", task.id);
      const { cp } = await import("node:fs/promises");
      await cp(store.taskDirectory(completed), destination, { recursive: true });
    } });
  });

  it("rejects producer settings outside album generation", () => {
    expect(() => parseTaskInput({ description: "music", produceAlbum: true })).toThrow("album generation");
    expect(() => parseTaskInput({ description: "music", workflowType: "04-album", mode: "compose", produceAlbum: true })).toThrow("album generation");
    expect(() => parseTaskInput({ description: "music", workflowType: "04-album", produceAlbum: "yes" })).toThrow("boolean");
  });
});
