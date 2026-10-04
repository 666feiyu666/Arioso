import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stitchAudioFiles, stitchMp3Files } from "../src/audio/stitch.js";
import { decodeWav16, encodeWav16 } from "../src/audio/wav.js";

const MPEG1_192K_44100_STEREO = Buffer.from([0xff, 0xfb, 0xb0, 0x44]);
const EMPTY_ID3V2_TAG = Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]);

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "arioso-audio-stitch-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function mp3Frame(header = MPEG1_192K_44100_STEREO, frameLength = 626): Buffer {
  const frame = Buffer.alloc(frameLength);
  header.copy(frame);
  return frame;
}

function taggedMp3(frameCount: number, header = MPEG1_192K_44100_STEREO, frameLength = 626): Buffer {
  return Buffer.concat([
    EMPTY_ID3V2_TAG,
    ...Array.from({ length: frameCount }, () => mp3Frame(header, frameLength)),
  ]);
}

async function prepareInputs(firstData: Buffer, secondData: Buffer, extension = ".mp3") {
  const first = path.join(directory, `first${extension}`);
  const second = path.join(directory, `second${extension}`);
  const output = path.join(directory, `complete${extension}`);
  await Promise.all([writeFile(first, firstData), writeFile(second, secondData)]);
  return { inputs: [first, second], output };
}

describe("MP3 assembly", () => {
  it("removes per-segment metadata and concatenates compatible MPEG frames", async () => {
    const { inputs, output } = await prepareInputs(taggedMp3(2), taggedMp3(3));

    const result = await stitchAudioFiles(output, inputs);
    const assembled = await readFile(output);

    expect(assembled.subarray(0, 4)).toEqual(MPEG1_192K_44100_STEREO);
    expect(assembled.length).toBe(5 * 626);
    expect(result.sampleRate).toBe(44_100);
    expect(result.channels).toBe(2);
    expect(result.segmentDurationsSeconds).toHaveLength(2);
    expect(result.durationSeconds).toBeCloseTo(5 * 1_152 / 44_100, 8);
  });

  it("rejects incompatible sample rates", async () => {
    const differentRateHeader = Buffer.from([0xff, 0xfb, 0xb4, 0x44]);
    const { inputs, output } = await prepareInputs(taggedMp3(2), taggedMp3(2, differentRateHeader, 576));

    await expect(stitchMp3Files(output, inputs))
      .rejects.toThrow("same MPEG version, sample rate, and channel count");
  });

  it.each(["Xing", "Info", "VBRI"])(
    "preserves audio frames containing %s away from the metadata offset",
    async (tag) => {
      const frame = mp3Frame();
      frame.write(tag, 100, "ascii");
      const { inputs, output } = await prepareInputs(frame, mp3Frame());

      const result = await stitchMp3Files(output, inputs);

      expect(await readFile(output)).toEqual(Buffer.concat([frame, mp3Frame()]));
      expect(result.durationSeconds).toBeCloseTo(2 * 1_152 / 44_100, 8);
    },
  );

  it.each([
    { tag: "Xing", header: MPEG1_192K_44100_STEREO, frameLength: 626, offset: 36 },
    { tag: "Info", header: Buffer.from([0xff, 0xfb, 0xb0, 0xc4]), frameLength: 626, offset: 21 },
    { tag: "Xing", header: Buffer.from([0xff, 0xf3, 0xb0, 0x44]), frameLength: 365, offset: 21 },
    { tag: "Info", header: Buffer.from([0xff, 0xf3, 0xb0, 0xc4]), frameLength: 365, offset: 13 },
    { tag: "VBRI", header: MPEG1_192K_44100_STEREO, frameLength: 626, offset: 36 },
  ])("removes $tag at metadata offset $offset", async ({ tag, header, frameLength, offset }) => {
    const metadata = mp3Frame(header, frameLength);
    metadata.write(tag, offset, "ascii");
    const audio = mp3Frame(header, frameLength);
    const { inputs, output } = await prepareInputs(Buffer.concat([metadata, audio]), audio);

    const result = await stitchMp3Files(output, inputs);

    expect(await readFile(output)).toEqual(Buffer.concat([audio, audio]));
    expect(result.segmentDurationsSeconds[0]).toBe(result.segmentDurationsSeconds[1]);
  });

  it("rejects a truncated MP3 frame before writing output", async () => {
    const { inputs, output } = await prepareInputs(mp3Frame().subarray(0, 100), mp3Frame());

    await expect(stitchMp3Files(output, inputs)).rejects.toThrow("is truncated");
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("WAV file assembly", () => {
  it("routes WAV inputs through PCM concatenation", async () => {
    const first = encodeWav16({ sampleRate: 8_000, channelData: [Float32Array.of(-1, 0)] });
    const second = encodeWav16({ sampleRate: 8_000, channelData: [Float32Array.of(1)] });
    const { inputs, output } = await prepareInputs(first, second, ".wav");

    const result = await stitchAudioFiles(output, inputs);
    const combined = decodeWav16(await readFile(output));

    expect([...combined.channelData[0]!]).toEqual([-1, 0, 1]);
    expect(result.durationSeconds).toBe(3 / 8_000);
    expect(result.segmentDurationsSeconds).toEqual([2 / 8_000, 1 / 8_000]);
  });
});
