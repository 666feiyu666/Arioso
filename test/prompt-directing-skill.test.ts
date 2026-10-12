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

  it("listens for the user's feeling and carries it into the proposal", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Listen for how the user feels");
    expect(discussion).toContain("musical imagery or synesthesia");
    expect(proposal).toContain("emotional tone settled in the discussion");
  });

  it("keeps duration in view while directing and committing to a prompt", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Keep duration in mind");
    expect(proposal).toContain("State the intended duration explicitly");
  });
});
