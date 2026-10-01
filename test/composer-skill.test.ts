import { describe, expect, it } from "vitest";

import { loadComposerSkill } from "../src/composer/composer-skill.js";

describe("composer skill", () => {
  it("loads the local Lyria guidance used by the composer agent", async () => {
    const skill = await loadComposerSkill();

    expect(skill).toContain("lyria-3-clip-preview");
    expect(skill).toContain("lyria-3.5");
    expect(skill).toContain("instrumental only, no vocals");
    expect(skill).not.toContain("[TODO:");
  });

  it("loads orchestral continuity guidance only for orchestral composition", async () => {
    const single = await loadComposerSkill();
    const orchestral = await loadComposerSkill("orchestral");

    expect(single).not.toContain("Each Lyria generation is independent");
    expect(orchestral).toContain("Each Lyria generation is independent");
    expect(orchestral).toContain("entrance and exit explicitly");
    expect(orchestral).not.toContain("[TODO:");
  });
});
