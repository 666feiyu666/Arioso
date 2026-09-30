import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SettingsStore } from "../src/config/settings.js";

async function withSettings(
  test: (store: SettingsStore, root: string, envPath: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-settings-"));
  const envPath = path.join(root, ".env");
  const store = new SettingsStore({
    envPath,
    preferencesPath: path.join(root, "settings.json"),
    environment: {},
  });
  try {
    await test(store, root, envPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("SettingsStore", () => {
  it("validates and persists the interface language", async () => {
    await withSettings(async (store, root) => {
      expect(await store.language()).toBe("zh-CN");

      await store.saveLanguage("en");

      expect(await store.language()).toBe("en");
      expect(JSON.parse(await readFile(path.join(root, "settings.json"), "utf8"))).toEqual({
        language: "en",
      });
    });
  });

  it("uses session, local, then environment credential precedence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "arioso-settings-"));
    const envPath = path.join(root, ".env");
    try {
      await writeFile(envPath, "OPENAI_API_KEY=sk-local-1234\n", "utf8");
      const store = new SettingsStore({
        envPath,
        preferencesPath: path.join(root, "settings.json"),
        environment: { OPENAI_API_KEY: "sk-environment-1234" },
      });

      expect(await store.resolveCredential("openai")).toBe("sk-local-1234");
      await store.saveCredential("openai", "sk-session-5678", false);
      expect(await store.resolveCredential("openai")).toBe("sk-session-5678");
      expect((await store.snapshot()).credentials.openai).toEqual({
        configured: true,
        masked: "••••5678",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("updates dotenv credentials without changing unrelated settings", async () => {
    await withSettings(async (store, _root, envPath) => {
      await writeFile(envPath, "OTHER_SETTING=keep\nOPENAI_API_KEY=old\n", "utf8");

      await store.saveCredential("openai", "sk-new-9876", true);
      const saved = await readFile(envPath, "utf8");
      expect(saved).toContain("OTHER_SETTING=keep");
      expect(saved).toContain('OPENAI_API_KEY="sk-new-9876"');
      expect(saved).not.toContain("OPENAI_API_KEY=old");

      await store.clearCredential("openai");
      const cleared = await readFile(envPath, "utf8");
      expect(cleared).toContain("OTHER_SETTING=keep");
      expect(cleared).not.toContain("OPENAI_API_KEY");
    });
  });
});
