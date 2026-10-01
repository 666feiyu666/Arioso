import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("workflow entry page", () => {
  it("offers orchestral composition and an album development placeholder", async () => {
    const html = await readFile("web/index.html", "utf8");

    expect(html).toContain('data-composition-mode="orchestral"');
    expect(html).toContain('data-composition-mode="album"');
    expect(html).toContain('id="development-view"');
  });
});
