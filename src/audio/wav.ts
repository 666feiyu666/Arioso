export interface PcmAudio {
  sampleRate: number;
  channelData: Float32Array[];
}

const UINT32_MAX = 0xffff_ffff;
const BYTES_PER_SAMPLE = 2;

function pcmFrameCount(audio: PcmAudio): number {
  if (!Number.isInteger(audio.sampleRate) || audio.sampleRate <= 0 || audio.sampleRate > UINT32_MAX) {
    throw new Error("PCM sample rate must be a positive 32-bit integer.");
  }
  const firstChannel = audio.channelData[0];
  if (!firstChannel) {
    throw new Error("PCM audio must contain at least one channel.");
  }
  if (!audio.channelData.every((channel) => channel.length === firstChannel.length)) {
    throw new Error("All WAV channels must have the same number of frames.");
  }
  return firstChannel.length;
}

export function durationSeconds(audio: PcmAudio): number {
  return pcmFrameCount(audio) / audio.sampleRate;
}

export function concatenateAudio(segments: readonly PcmAudio[]): PcmAudio {
  const first = segments[0];
  if (!first) {
    throw new Error("At least one WAV segment is required.");
  }

  const channelCount = first.channelData.length;
  let totalFrames = 0;
  for (const segment of segments) {
    totalFrames += pcmFrameCount(segment);
    if (segment.sampleRate !== first.sampleRate) {
      throw new Error("All WAV segments must use the same sample rate.");
    }
    if (segment.channelData.length !== channelCount) {
      throw new Error("All WAV segments must use the same channel count.");
    }
  }

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
  const frameCount = pcmFrameCount(audio);
  if (frameCount === 0) {
    throw new Error("Cannot encode an empty WAV file.");
  }

  const blockAlign = channelCount * BYTES_PER_SAMPLE;
  const byteRate = audio.sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  if (blockAlign > 0xffff || byteRate > UINT32_MAX || dataSize > UINT32_MAX - 36) {
    throw new Error("PCM audio exceeds the size limits of a 16-bit RIFF WAV file.");
  }

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(audio.sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of audio.channelData) {
      const value = channel[frame]!;
      if (!Number.isFinite(value)) {
        throw new Error("WAV samples must be finite numbers.");
      }
      const sample = Math.max(-1, Math.min(1, value));
      buffer.writeInt16LE(
        sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
        offset,
      );
      offset += BYTES_PER_SAMPLE;
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

  const riffEnd = 8 + buffer.readUInt32LE(4);
  if (riffEnd < 12 || riffEnd > buffer.length) {
    throw new Error("WAV RIFF size exceeds the available file data or omits the WAVE header.");
  }

  let offset = 12;
  let channelCount: number | undefined;
  let sampleRate: number | undefined;
  let blockAlign: number | undefined;
  let dataOffset: number | undefined;
  let dataSize: number | undefined;

  while (offset < riffEnd) {
    if (offset + 8 > riffEnd) {
      throw new Error("WAV chunk header is truncated.");
    }
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    const nextChunkOffset = chunkDataOffset + chunkSize + (chunkSize % 2);
    if (nextChunkOffset > riffEnd) {
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

    offset = nextChunkOffset;
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
