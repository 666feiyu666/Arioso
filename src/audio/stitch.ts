import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  concatenateAudio,
  decodeWav16,
  durationSeconds,
  encodeWav16,
  type PcmAudio,
} from "./wav.js";

export interface StitchWavResult {
  outputPath: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  segmentDurationsSeconds: number[];
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
