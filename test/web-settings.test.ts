import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

describe("web settings API", () => {
  it("persists language and never echoes configured secrets", async () => {
    await withWebServer(async ({ root, baseUrl }) => {
      const preferencesPath = path.join(root, "settings.json");
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
    });
  });
});
