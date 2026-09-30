export interface PcmAudio {
  sampleRate: number;
  channelData: Float32Array[];
}

export function durationSeconds(audio: PcmAudio): number {
  return (audio.channelData[0]?.length ?? 0) / audio.sampleRate;
}

export function concatenateAudio(segments: readonly PcmAudio[]): PcmAudio {
  const first = segments[0];
  if (!first) {
    throw new Error("At least one WAV segment is required.");
  }

  const channelCount = first.channelData.length;
  for (const segment of segments) {
    if (segment.sampleRate !== first.sampleRate) {
      throw new Error("All WAV segments must use the same sample rate.");
    }
    if (segment.channelData.length !== channelCount) {
      throw new Error("All WAV segments must use the same channel count.");
    }
  }

  const totalFrames = segments.reduce(
    (sum, segment) => sum + (segment.channelData[0]?.length ?? 0),
    0,
  );
  const channelData = Array.from({ length: channelCount }, (_, channelIndex) => {
    const output = new Float32Array(totalFrames);
    let offset = 0;
    for (const segment of segments) {
      const channel = segment.channelData[channelIndex]!;
      output.set(channel, offset);
      offset += channel.length;
    }
    return output;
  });

  return { sampleRate: first.sampleRate, channelData };
}

export function encodeWav16(audio: PcmAudio): Buffer {
  const channelCount = audio.channelData.length;
  const frameCount = audio.channelData[0]?.length ?? 0;
  if (channelCount === 0 || frameCount === 0) {
    throw new Error("Cannot encode an empty WAV file.");
  }
  if (!audio.channelData.every((channel) => channel.length === frameCount)) {
    throw new Error("All WAV channels must have the same number of frames.");
  }

  const bytesPerSample = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(audio.sampleRate, 24);
  buffer.writeUInt32LE(audio.sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of audio.channelData) {
      const sample = Math.max(-1, Math.min(1, channel[frame]!));
      buffer.writeInt16LE(
        sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
        offset,
      );
      offset += bytesPerSample;
    }
  }

  return buffer;
}

export function decodeWav16(data: Uint8Array): PcmAudio {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (
    buffer.length < 44
    || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Expected a RIFF WAVE file.");
  }

  let offset = 12;
  let channelCount: number | undefined;
  let sampleRate: number | undefined;
  let blockAlign: number | undefined;
  let dataOffset: number | undefined;
  let dataSize: number | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkSize > buffer.length) {
      throw new Error("WAV chunk exceeds the available file data.");
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16 || buffer.readUInt16LE(chunkDataOffset) !== 1) {
        throw new Error("Only uncompressed PCM WAV files are supported.");
      }
      channelCount = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      blockAlign = buffer.readUInt16LE(chunkDataOffset + 12);
      if (buffer.readUInt16LE(chunkDataOffset + 14) !== 16) {
        throw new Error("Only 16-bit PCM WAV files are supported.");
      }
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (!channelCount || !sampleRate || !blockAlign || dataOffset === undefined || dataSize === undefined) {
    throw new Error("WAV file is missing required format or sample data.");
  }
  const expectedBlockAlign = channelCount * 2;
  if (blockAlign !== expectedBlockAlign || dataSize % blockAlign !== 0) {
    throw new Error("WAV sample data is not valid interleaved 16-bit PCM.");
  }

  const frameCount = dataSize / blockAlign;
  const channelData = Array.from(
    { length: channelCount },
    () => new Float32Array(frameCount),
  );
  let sampleOffset = dataOffset;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of channelData) {
      const sample = buffer.readInt16LE(sampleOffset);
      channel[frame] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
      sampleOffset += 2;
    }
  }

  return { sampleRate, channelData };
}
