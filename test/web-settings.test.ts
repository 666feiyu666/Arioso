import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAriosoServer } from "../src/web/server.js";

describe("web settings API", () => {
  it("persists language and never echoes configured secrets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "arioso-web-settings-"));
    const preferencesPath = path.join(root, "settings.json");
    const server = await createAriosoServer({
      envPath: path.join(root, ".env"),
      preferencesPath,
      environment: { ARIOSO_OUTPUT_DIR: path.join(root, "outputs") },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const initial = await fetch(`${baseUrl}/api/settings`).then((response) => response.json());
      expect(initial).toEqual({
        language: "zh-CN",
        credentials: {
          openai: { configured: false, masked: null },
          gemini: { configured: false, masked: null },
        },
      });

      const secret = "sk-browser-session-2468";
      const response = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "en",
          remember: false,
          credentials: { openai: secret },
        }),
      });
      const savedText = await response.text();
      expect(response.ok).toBe(true);
      expect(savedText).not.toContain(secret);
      expect(JSON.parse(savedText)).toEqual({
        language: "en",
        credentials: {
          openai: { configured: true, masked: "••••2468" },
          gemini: { configured: false, masked: null },
        },
      });
      expect(JSON.parse(await readFile(preferencesPath, "utf8"))).toEqual({ language: "en" });
    } finally {
      server.close();
      await once(server, "close");
      await rm(root, { recursive: true, force: true });
    }
  });
});
