import { describe, expect, it } from "vitest";

import { loadPromptDirectingSkill } from "../src/discussion/prompt-directing-skill.js";

describe("prompt directing skill", () => {
  it("loads the shared Prompt Director identity for each phase", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Arioso Prompt Director");
    expect(proposal).toContain("Arioso Prompt Director");
    expect(discussion).not.toContain("[TODO:");
    expect(proposal).not.toContain("[TODO:");
  });

  it("loads discussion guidance only while directing the conversation", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("copy-ready final prompt");
    expect(discussion).toContain("plain text without Markdown");
    expect(proposal).not.toContain("copy-ready final prompt");
  });

  it("loads final prompt guidance only when producing the proposal", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("Return only the prompt itself");
    expect(proposal).toContain("require original material");
    expect(discussion).not.toContain("Return only the prompt itself");
  });

  it("listens for the user's feeling and unfolds it in poetic language first", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Listen for how the user feels");
    expect(discussion).toContain("poetic, sensory language");
    expect(discussion).toContain("do not yet fix instrumentation");
    expect(proposal).toContain("poetic, sensory sentences");
    expect(proposal).toContain("emotional tone settled in the discussion");
  });

  it("keeps duration in view while directing and committing to a prompt", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Keep duration in mind");
    expect(proposal).toContain("State the intended duration explicitly");
  });

  it("treats retrieved poems as optional reference data in both phases", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    for (const skill of [discussion, proposal]) {
      expect(skill).toContain("Arioso Prompt Director");
      expect(skill).toContain("<poem-reference>");
      expect(skill).toContain("optional reference data");
      expect(skill).toContain("The user's own words stay authoritative");
    }
  });

  it("keeps the discussion concise, image-led and free of technical detail", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");

    expect(discussion).toContain("at most one clear sensory image");
    expect(discussion).toContain("at most one gentle question");
    expect(discussion).toContain("Begin with the user's emotional centre");
    expect(discussion).toContain("do not yet fix instrumentation");
    expect(discussion).toContain("never mention retrieval");
    expect(discussion).toContain("direct safety language overrides");
  });

  it("asks the proposal for a musical brief rather than a Lyria prompt", async () => {
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("not a final Lyria prompt");
    expect(proposal).toContain("important exclusions");
    expect(proposal).toContain("never name a poet");
    expect(proposal).toContain("Drop a poem whose implications conflict with the user");
  });
});
