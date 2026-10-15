import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const sample = path.resolve("Assets/music/red-example.mp3");
const hasSample = existsSync(sample);

describe("static asset serving", () => {
  it.skipIf(!hasSample)("serves the mood example audio with an audio content type", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/assets/music/red-example.mp3`, { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/mpeg");
      expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    });
  });

  it("does not serve files outside Assets/", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const traversal = await fetch(`${baseUrl}/assets/%2e%2e/package.json`);
      expect(traversal.status).toBe(404);
      const missing = await fetch(`${baseUrl}/assets/music/nope.mp3`);
      expect(missing.status).toBe(404);
    });
  });

  it("keeps the web pages working alongside the asset route", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const page = await fetch(`${baseUrl}/`);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
    });
  });
});
