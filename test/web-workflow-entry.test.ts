import { describe, expect, it } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

describe("workflow entry page", () => {
  it("serves each workflow choice with its matching composition and corpus modes", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/`);
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
      expect(html).toMatch(/\bid=["']album-view["']/);
      expect(html).toMatch(/\bid=["']playlist-controls["']/);
      expect(html).not.toMatch(/\bid=["']development-view["']/);
    });
  });
});
