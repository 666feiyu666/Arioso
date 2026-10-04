import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const pendingWrites = new Map<string, Promise<void>>();

/** Replace a complete text file, preserving write order for each destination. */
export function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  const destination = path.resolve(filePath);
  const previous = pendingWrites.get(destination) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(destination), { recursive: true });
    const temporaryPath = `${destination}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, content, "utf8");
      await rename(temporaryPath, destination);
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
  });
  pendingWrites.set(destination, write);
  const forget = () => {
    if (pendingWrites.get(destination) === write) pendingWrites.delete(destination);
  };
  void write.then(forget, forget);
  return write;
}
