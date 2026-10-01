import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { stitchAudioFiles, stitchMp3Files } from "../src/audio/stitch.js";

const MPEG1_192K_44100_STEREO = Buffer.from([0xff, 0xfb, 0xb0, 0x44]);

function mp3Frame(header = MPEG1_192K_44100_STEREO, frameLength = 626): Buffer {
  const frame = Buffer.alloc(frameLength);
  header.copy(frame);
  return frame;
}

function taggedMp3(frameCount: number): Buffer {
  const emptyId3v2Tag = Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]);
  return Buffer.concat([
    emptyId3v2Tag,
    ...Array.from({ length: frameCount }, () => mp3Frame()),
  ]);
}

describe("MP3 assembly", () => {
  it("removes per-segment metadata and concatenates compatible MPEG frames", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-mp3-stitch-"));
    const first = path.join(directory, "first.mp3");
    const second = path.join(directory, "second.mp3");
    const output = path.join(directory, "complete.mp3");
    await writeFile(first, taggedMp3(2));
    await writeFile(second, taggedMp3(3));

    const result = await stitchAudioFiles(output, [first, second]);
    const assembled = await readFile(output);

    expect(assembled.subarray(0, 4)).toEqual(MPEG1_192K_44100_STEREO);
    expect(assembled.length).toBe(5 * 626);
    expect(result.sampleRate).toBe(44_100);
    expect(result.channels).toBe(2);
    expect(result.segmentDurationsSeconds).toHaveLength(2);
    expect(result.durationSeconds).toBeCloseTo(5 * 1_152 / 44_100, 8);
  });

  it("rejects incompatible sample rates", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "arioso-mp3-stitch-"));
    const first = path.join(directory, "first.mp3");
    const second = path.join(directory, "second.mp3");
    await writeFile(first, taggedMp3(2));
    const differentRateHeader = Buffer.from([0xff, 0xfb, 0xb4, 0x44]);
    await writeFile(second, Buffer.concat([
      Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0]),
      mp3Frame(differentRateHeader, 576),
      mp3Frame(differentRateHeader, 576),
    ]));

    await expect(stitchMp3Files(path.join(directory, "complete.mp3"), [first, second]))
      .rejects.toThrow("same MPEG version, sample rate, and channel count");
  });
});
