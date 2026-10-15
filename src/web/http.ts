import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const WEB_ROOT = path.resolve("web");
const ASSETS_ROOT = path.resolve("Assets");
const MAX_BODY_BYTES = 64 * 1024;
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

interface ByteRange {
  start: number;
  end: number;
}

function parseByteRange(value: string, fileSize: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || fileSize <= 0 || (!match[1] && !match[2])) {
    return null;
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || start >= fileSize
    || requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}

export async function sendAudio(
  request: IncomingMessage,
  response: ServerResponse,
  filePath: string,
): Promise<void> {
  let file;
  try {
    file = await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HttpError(404, "Audio is not available.");
    }
    throw error;
  }
  if (!file.isFile()) throw new HttpError(404, "Audio is not available.");
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "Content-Type": ({ ".wav": "audio/wav", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8", ".json": "application/json" } as Record<string, string>)[path.extname(filePath).toLowerCase()] ?? "audio/mpeg",
  };

  if (request.method === "HEAD") {
    response.writeHead(200, {
      ...baseHeaders,
      "Content-Length": file.size,
    });
    response.end();
    return;
  }

  const rangeHeader = request.headers.range;
  if (!rangeHeader) {
    response.writeHead(200, {
      ...baseHeaders,
      "Content-Length": file.size,
    });
    await pipeline(createReadStream(filePath), response);
    return;
  }

  const range = parseByteRange(rangeHeader, file.size);
  if (!range) {
    response.writeHead(416, {
      ...baseHeaders,
      "Content-Length": 0,
      "Content-Range": `bytes */${file.size}`,
    });
    response.end();
    return;
  }

  response.writeHead(206, {
    ...baseHeaders,
    "Content-Length": range.end - range.start + 1,
    "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
  });
  await pipeline(createReadStream(filePath, range), response);
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    // Drain an oversized request so the client can receive the error response.
    if (size <= MAX_BODY_BYTES) chunks.push(buffer);
  }

  if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large.");

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export async function readBinaryBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    // Drain oversized requests so the server can return a normal 413 response.
    if (size <= maximumBytes) chunks.push(buffer);
  }

  if (size > maximumBytes) throw new HttpError(413, "Request body is too large.");
  return Buffer.concat(chunks);
}

export async function sendFile(
  request: IncomingMessage,
  response: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  let file;
  try {
    file = await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "File is not available.");
    throw error;
  }
  if (!file.isFile()) throw new HttpError(404, "File is not available.");
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": file.size,
    "Cache-Control": "private, no-cache",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  await pipeline(createReadStream(filePath), response);
}

async function serveFromRoot(
  root: string,
  pathname: string,
  response: ServerResponse,
  method: string,
): Promise<void> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relative);
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
      "Content-Length": file.size,
      "Cache-Control": "no-cache",
    });
    if (method === "HEAD") {
      response.end();
      return;
    }
    await pipeline(createReadStream(filePath), response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

/** Serve files from the web/ directory (pages, scripts, styles). */
export function serveStatic(pathname: string, response: ServerResponse, method = "GET"): Promise<void> {
  return serveFromRoot(WEB_ROOT, pathname, response, method);
}

/** Serve the project's Assets/ directory, e.g. the mood example audio. */
export function serveAsset(pathname: string, response: ServerResponse, method = "GET"): Promise<void> {
  return serveFromRoot(ASSETS_ROOT, pathname, response, method);
}
