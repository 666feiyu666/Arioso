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

  it("draws abstract feelings into concrete details instead of either/or questions", async () => {
    const discussion = await loadPromptDirectingSkill("discussion");
    const proposal = await loadPromptDirectingSkill("proposal");

    expect(discussion).toContain("我是你的情绪导演");
    expect(discussion).toContain("mood director");
    expect(discussion).toContain("two or three short film-like scenes");
    expect(discussion).toContain("drawing their concrete imagery and settings from a retrieved poem");
    expect(discussion).toContain("without naming camera or directorial terms");
    expect(discussion).toContain("neither a single line nor a long passage");
    expect(discussion).toContain("Write before you ask");
    expect(discussion).toContain("what is there rather than which of two labels fits");
    expect(discussion).toContain("either/or choice questions");
    expect(discussion).toContain("detailed instrumentation");
    expect(discussion).toContain("belong to the Composer");
    expect(proposal).toContain("Carry the concrete moments, objects and sensations");
    expect(proposal).toContain("left to the Composer");
  });
});
