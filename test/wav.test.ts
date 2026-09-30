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
});
