import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  concatenateAudio,
  decodeWav16,
  durationSeconds,
  encodeWav16,
  type PcmAudio,
} from "./wav.js";

export interface StitchAudioResult {
  outputPath: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  segmentDurationsSeconds: number[];
}

export type StitchWavResult = StitchAudioResult;
export type StitchMp3Result = StitchAudioResult;

interface Mp3FrameInfo {
  version: 1 | 2 | 2.5;
  bitrateKbps: number;
  sampleRate: number;
  channels: number;
  samplesPerFrame: number;
  frameLength: number;
}

interface ParsedMp3Segment {
  audioFrames: Buffer;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  version: Mp3FrameInfo["version"];
}

const MPEG1_LAYER3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
] as const;
const MPEG2_LAYER3_BITRATES = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
] as const;
const MPEG1_SAMPLE_RATES = [44_100, 48_000, 32_000] as const;

function parseMp3FrameHeader(data: Buffer, offset: number): Mp3FrameInfo {
  if (offset + 4 > data.length) {
    throw new Error("MP3 frame header is truncated.");
  }

  const header = data.readUInt32BE(offset);
  if ((header >>> 21) !== 0x7ff) {
    throw new Error(`Invalid MP3 frame sync at byte ${offset}.`);
  }

  const versionBits = (header >>> 19) & 0b11;
  const layerBits = (header >>> 17) & 0b11;
  if (versionBits === 0b01 || layerBits !== 0b01) {
    throw new Error("Only MPEG Layer III audio is supported for MP3 assembly.");
  }
  const version: Mp3FrameInfo["version"] = versionBits === 0b11
    ? 1
    : versionBits === 0b10
      ? 2
      : 2.5;

  const bitrateIndex = (header >>> 12) & 0b1111;
  const sampleRateIndex = (header >>> 10) & 0b11;
  if (bitrateIndex === 0 || bitrateIndex === 0b1111 || sampleRateIndex === 0b11) {
    throw new Error("Unsupported MP3 bitrate or sample-rate header.");
  }

  const bitrateKbps = (version === 1
    ? MPEG1_LAYER3_BITRATES
    : MPEG2_LAYER3_BITRATES)[bitrateIndex]!;
  const baseSampleRate = MPEG1_SAMPLE_RATES[sampleRateIndex]!;
  const sampleRate = version === 1
    ? baseSampleRate
    : version === 2
      ? baseSampleRate / 2
      : baseSampleRate / 4;
  const padding = (header >>> 9) & 1;
  const samplesPerFrame = version === 1 ? 1_152 : 576;
  const frameLength = Math.floor(
    (version === 1 ? 144_000 : 72_000) * bitrateKbps / sampleRate,
  ) + padding;
  const channelMode = (header >>> 6) & 0b11;

  return {
    version,
    bitrateKbps,
    sampleRate,
    channels: channelMode === 0b11 ? 1 : 2,
    samplesPerFrame,
    frameLength,
  };
}

function id3v2End(data: Buffer): number {
  if (data.length < 10 || data.toString("ascii", 0, 3) !== "ID3") return 0;
  const sizeBytes = data.subarray(6, 10);
  if ([...sizeBytes].some((byte) => byte >= 0x80)) {
    throw new Error("Invalid ID3v2 synchsafe size.");
  }
  const tagSize = (sizeBytes[0]! << 21)
    | (sizeBytes[1]! << 14)
    | (sizeBytes[2]! << 7)
    | sizeBytes[3]!;
  const end = 10 + tagSize;
  if (end > data.length) throw new Error("ID3v2 tag exceeds the MP3 file size.");
  return end;
}

function mp3AudioEnd(data: Buffer): number {
  return data.length >= 128 && data.toString("ascii", data.length - 128, data.length - 125) === "TAG"
    ? data.length - 128
    : data.length;
}

function isVbrMetadataFrame(frame: Buffer, info: Mp3FrameInfo): boolean {
  const sideInfoLength = info.version === 1
    ? (info.channels === 1 ? 17 : 32)
    : (info.channels === 1 ? 9 : 17);
  // Xing/Info follows the MPEG header and side information; VBRI has a fixed offset.
  const xingOffset = 4 + sideInfoLength;
  const xingTag = frame.toString("latin1", xingOffset, xingOffset + 4);
  return xingTag === "Xing"
    || xingTag === "Info"
    || frame.toString("latin1", 36, 40) === "VBRI";
}

function parseMp3Segment(data: Uint8Array): ParsedMp3Segment {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const start = id3v2End(buffer);
  const end = mp3AudioEnd(buffer);
  if (start >= end) throw new Error("MP3 file contains no audio frames.");

  const frames: Array<{ offset: number; info: Mp3FrameInfo }> = [];
  let offset = start;
  let reference: Mp3FrameInfo | undefined;
  while (offset + 4 <= end) {
    const info = parseMp3FrameHeader(buffer, offset);
    if (offset + info.frameLength > end) {
      throw new Error(`MP3 frame at byte ${offset} is truncated.`);
    }
    if (
      reference
      && (
        info.version !== reference.version
        || info.sampleRate !== reference.sampleRate
        || info.channels !== reference.channels
      )
    ) {
      throw new Error("MP3 segment changes its MPEG version, sample rate, or channel count.");
    }
    reference ??= info;
    frames.push({ offset, info });
    offset += info.frameLength;
  }

  if (!reference || frames.length === 0) throw new Error("MP3 file contains no audio frames.");
  if (offset !== end && buffer.subarray(offset, end).some((byte) => byte !== 0)) {
    throw new Error(`Unexpected data after the final MP3 frame at byte ${offset}.`);
  }

  const first = frames[0]!;
  const firstFrame = buffer.subarray(first.offset, first.offset + first.info.frameLength);
  const audioFrames = isVbrMetadataFrame(firstFrame, first.info) ? frames.slice(1) : frames;
  if (audioFrames.length === 0) throw new Error("MP3 file contains metadata but no audio frames.");

  const durationSeconds = audioFrames.reduce(
    (seconds, frame) => seconds + frame.info.samplesPerFrame / frame.info.sampleRate,
    0,
  );
  return {
    audioFrames: Buffer.concat(audioFrames.map((frame) =>
      buffer.subarray(frame.offset, frame.offset + frame.info.frameLength)
    )),
    durationSeconds,
    sampleRate: reference.sampleRate,
    channels: reference.channels,
    version: reference.version,
  };
}

export function measureAudioDuration(data: Uint8Array): number {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (
    buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return durationSeconds(decodeWav16(buffer));
  }
  return parseMp3Segment(buffer).durationSeconds;
}
export async function stitchWavFiles(
  outputFile: string,
  inputFiles: readonly string[],
): Promise<StitchWavResult> {
  if (inputFiles.length < 2) {
    throw new Error("At least two input WAV files are required.");
  }

  const inputPaths = inputFiles.map((file) => path.resolve(file));
  const segments: PcmAudio[] = [];
  for (const inputPath of inputPaths) {
    if (path.extname(inputPath).toLowerCase() !== ".wav") {
      throw new Error(`Input must be a WAV file: ${inputPath}`);
    }
    segments.push(decodeWav16(await readFile(inputPath)));
  }

  const outputPath = path.resolve(outputFile);
  if (path.extname(outputPath).toLowerCase() !== ".wav") {
    throw new Error("The stitched output filename must end in .wav.");
  }

  const combined = concatenateAudio(segments);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, encodeWav16(combined));

  return {
    outputPath,
    durationSeconds: durationSeconds(combined),
    sampleRate: combined.sampleRate,
    channels: combined.channelData.length,
    segmentDurationsSeconds: segments.map(durationSeconds),
  };
}

export async function stitchMp3Files(
  outputFile: string,
  inputFiles: readonly string[],
): Promise<StitchMp3Result> {
  if (inputFiles.length < 2) {
    throw new Error("At least two input MP3 files are required.");
  }

  const inputPaths = inputFiles.map((file) => path.resolve(file));
  const segments: ParsedMp3Segment[] = [];
  for (const inputPath of inputPaths) {
    if (path.extname(inputPath).toLowerCase() !== ".mp3") {
      throw new Error(`Input must be an MP3 file: ${inputPath}`);
    }
    segments.push(parseMp3Segment(await readFile(inputPath)));
  }

  const first = segments[0]!;
  for (const segment of segments) {
    if (
      segment.version !== first.version
      || segment.sampleRate !== first.sampleRate
      || segment.channels !== first.channels
    ) {
      throw new Error("All MP3 segments must use the same MPEG version, sample rate, and channel count.");
    }
  }

  const outputPath = path.resolve(outputFile);
  if (path.extname(outputPath).toLowerCase() !== ".mp3") {
    throw new Error("The stitched output filename must end in .mp3.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat(segments.map((segment) => segment.audioFrames)));

  return {
    outputPath,
    durationSeconds: segments.reduce((sum, segment) => sum + segment.durationSeconds, 0),
    sampleRate: first.sampleRate,
    channels: first.channels,
    segmentDurationsSeconds: segments.map((segment) => segment.durationSeconds),
  };
}

export function stitchAudioFiles(
  outputFile: string,
  inputFiles: readonly string[],
): Promise<StitchAudioResult> {
  const extension = path.extname(outputFile).toLowerCase();
  if (extension === ".wav") return stitchWavFiles(outputFile, inputFiles);
  if (extension === ".mp3") return stitchMp3Files(outputFile, inputFiles);
  throw new Error("Stitched audio output must be either .wav or .mp3.");
}
