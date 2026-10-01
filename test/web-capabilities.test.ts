import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAriosoServer } from "../src/web/server.js";

describe("web capabilities API", () => {
  it("advertises orchestral routing and the complete-work duration limit", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "arioso-capabilities-"));
    const server = await createAriosoServer({
      envPath: path.join(root, ".env"),
      preferencesPath: path.join(root, "settings.json"),
      environment: { ARIOSO_OUTPUT_DIR: path.join(root, "outputs") },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/capabilities`);
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({
        apiVersion: 3,
        workflows: ["01-general", "02-jazz", "03-orchestral"],
        orchestralAssembly: true,
        orchestralPromptFormat: "orchestral-v1",
        orchestralDuration: {
          minimumTotalMinutes: 5,
          maximumTotalMinutes: 11,
          maximumMovementMinutes: 3,
        },
      });
    } finally {
      server.close();
      await once(server, "close");
      await rm(root, { recursive: true, force: true });
    }
  });
});
