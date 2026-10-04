import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAriosoServer } from "../src/web/server.js";

describe("workflow entry page", () => {
  it("serves each workflow choice with its matching composition and corpus modes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "arioso-workflow-entry-"));
    const server = await createAriosoServer({
      envPath: path.join(root, ".env"),
      preferencesPath: path.join(root, "settings.json"),
      environment: { ARIOSO_OUTPUT_DIR: path.join(root, "outputs") },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      const html = await response.text();
      const workflows = [...html.matchAll(/<button\b([^>]*)>/g)]
        .map((match) => Object.fromEntries([...match[1]!.matchAll(
          /\b(data-workflow-type|data-composition-mode|data-corpus-mode)=["']([^"']+)["']/g,
        )].map((attribute) => [attribute[1], attribute[2]])))
        .filter((attributes) => attributes["data-workflow-type"]);

      expect(workflows).toEqual([
        { "data-workflow-type": "01-general", "data-composition-mode": "single", "data-corpus-mode": "none" },
        { "data-workflow-type": "02-jazz", "data-composition-mode": "single", "data-corpus-mode": "jazz" },
        { "data-workflow-type": "03-orchestral", "data-composition-mode": "orchestral", "data-corpus-mode": "none" },
        { "data-workflow-type": "04-album", "data-composition-mode": "album", "data-corpus-mode": "none" },
      ]);
      expect(html).toMatch(/\bid=["']development-view["']/);
    } finally {
      const closed = once(server, "close");
      server.close();
      await closed;
      await rm(root, { recursive: true, force: true });
    }
  });
});
