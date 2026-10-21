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

    expect(discussion).toContain("copy-ready final creative brief");
    expect(discussion).toContain("plain text without Markdown");
    expect(proposal).not.toContain("copy-ready final creative brief");
  });

  it("loads the two-paragraph brief contract only when producing the proposal", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("Return only the brief itself");
    expect(proposal).toContain("two prose paragraphs");
    expect(proposal).toContain("Paragraph 1: creative description");
    expect(proposal).toContain("Paragraph 2: musical direction");
    expect(proposal).toContain("not a final Lyria prompt");
    expect(proposal).toContain("require original material");
    expect(discussion).not.toContain("Return only the brief itself");
  });

  it("keeps the Director on emotional and sensory ground while the Composer realizes the music", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("Listen for how the user feels");
    expect(discussion).toContain("poetic, sensory language");
    expect(discussion).toContain("do not volunteer BPM");
    expect(proposal).toContain("Describe the experience the music should express");
    expect(proposal).toContain("Those mappings belong to the Composer");
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
    expect(discussion).toContain("do not volunteer BPM");
    expect(discussion).toContain("never mention retrieval");
    expect(discussion).toContain("direct safety language overrides");
  });

  it("asks the proposal for a musical brief rather than a Lyria prompt", async () => {
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("not a final Lyria prompt");
    expect(proposal).toContain("exclusions");
    expect(proposal).toContain("never name a poet");
    expect(proposal).toContain("Drop a poem whose implications conflict with the user");
  });

  it("records confirmed choices, preferences and open decisions separately", async () => {
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("Distinguish requirements from preferences");
    expect(proposal).toContain("Mark a possible suggestion as optional");
    expect(proposal).toContain("left to the Composer");
    expect(proposal).toContain("identify it as a default");
  });

  it("does not force the creative description into one or two sentences", async () => {
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(proposal).toContain("Four to seven sentences are a starting guideline");
    expect(proposal).toContain("not a minimum-length validator");
    expect(proposal).toContain("Emotional movement does not have to resolve");
  });
});
