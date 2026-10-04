import { describe, expect, it } from "vitest";

import {
  concatenateAudio,
  decodeWav16,
  durationSeconds,
  encodeWav16,
  type PcmAudio,
} from "../src/audio/wav.js";

function mono(samples: number[], sampleRate = 4): PcmAudio {
  return { sampleRate, channelData: [Float32Array.from(samples)] };
}

describe("WAV assembly", () => {
  it("concatenates complete PCM segments without overlap or trimming", () => {
    const first = mono([1, 1, 1]);
    const second = mono([0, 0, 0, 0]);
    const combined = concatenateAudio([first, second]);

    expect([...combined.channelData[0]!]).toEqual([1, 1, 1, 0, 0, 0, 0]);
    expect(durationSeconds(combined)).toBe(1.75);
  });

  it("encodes signed 16-bit PCM WAV metadata and samples", () => {
    const wav = encodeWav16(mono([-1, 0, 1], 8_000));

    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(8_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(6);
    expect(wav.readInt16LE(44)).toBe(-32_768);
    expect(wav.readInt16LE(46)).toBe(0);
    expect(wav.readInt16LE(48)).toBe(32_767);
  });

  it("decodes WAV output for resumable assembly", () => {
    const decoded = decodeWav16(encodeWav16(mono([-1, 0, 1], 8_000)));

    expect(decoded.sampleRate).toBe(8_000);
    expect(decoded.channelData).toHaveLength(1);
    expect([...decoded.channelData[0]!]).toEqual([-1, 0, 1]);
  });

  it("keeps stereo segments aligned when concatenating", () => {
    const combined = concatenateAudio([
      { sampleRate: 4, channelData: [Float32Array.of(1, 0), Float32Array.of(0, -1)] },
      { sampleRate: 4, channelData: [Float32Array.of(-1), Float32Array.of(1)] },
    ]);

    expect(combined.channelData.map((channel) => [...channel])).toEqual([
      [1, 0, -1],
      [0, -1, 1],
    ]);
  });

  it("rejects unequal channel lengths before concatenation", () => {
    const mismatched = {
      sampleRate: 4,
      channelData: [Float32Array.of(1, 0), Float32Array.of(1)],
    };

    expect(() => concatenateAudio([mismatched, mismatched]))
      .toThrow("same number of frames");
  });

  it.each([0, -1, 8_000.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid PCM sample rate %s",
    (sampleRate) => {
      expect(() => encodeWav16(mono([0], sampleRate))).toThrow("sample rate");
      expect(() => durationSeconds(mono([0], sampleRate))).toThrow("sample rate");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite PCM sample %s",
    (sample) => {
      expect(() => encodeWav16(mono([sample]))).toThrow("finite numbers");
    },
  );

  it("rejects PCM metadata that cannot fit the WAV header", () => {
    expect(() => encodeWav16(mono([0], 0x8000_0000))).toThrow("size limits");
  });

  it("does not treat bytes outside the declared RIFF chunk as sample data", () => {
    const wav = encodeWav16(mono([1], 8_000));
    const trailingData = Buffer.alloc(10);
    trailingData.write("data", 0, "ascii");
    trailingData.writeUInt32LE(2, 4);
    trailingData.writeInt16LE(-32_768, 8);

    const decoded = decodeWav16(Buffer.concat([wav, trailingData]));

    expect([...decoded.channelData[0]!]).toEqual([1]);
  });

  it("rejects a RIFF chunk that declares more bytes than are available", () => {
    const wav = encodeWav16(mono([0], 8_000));
    wav.writeUInt32LE(wav.length, 4);

    expect(() => decodeWav16(wav)).toThrow("RIFF size");
  });

  it("rejects chunks extending beyond the declared RIFF boundary", () => {
    const wav = encodeWav16(mono([0], 8_000));
    wav.writeUInt32LE(wav.length - 10, 4);

    expect(() => decodeWav16(wav)).toThrow("chunk exceeds");
  });

  it("rejects a truncated chunk header inside RIFF", () => {
    const wav = Buffer.concat([encodeWav16(mono([0], 8_000)), Buffer.of(0)]);
    wav.writeUInt32LE(wav.length - 8, 4);

    expect(() => decodeWav16(wav)).toThrow("chunk header is truncated");
  });

  it("skips unknown chunks including their odd-length padding", () => {
    const original = encodeWav16(mono([-1, 1], 8_000));
    const junk = Buffer.alloc(10);
    junk.write("JUNK", 0, "ascii");
    junk.writeUInt32LE(1, 4);
    junk[8] = 1;
    const wav = Buffer.concat([original.subarray(0, 12), junk, original.subarray(12)]);
    wav.writeUInt32LE(wav.length - 8, 4);

    expect([...decodeWav16(wav).channelData[0]!]).toEqual([-1, 1]);
  });
});
