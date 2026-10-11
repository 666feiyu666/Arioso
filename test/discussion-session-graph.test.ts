import { describe, expect, it } from "vitest";

import { resolveCreativeSessionPhase } from "../src/discussion/session-graph.js";

describe("creative session LangGraph", () => {
  it.each([
    ["discussing", undefined, "discussing"],
    ["proposal-ready", undefined, "proposal-ready"],
    ["submitted", "queued", "queued"],
    ["submitted", "composing", "composing"],
    ["submitted", "generating", "generating"],
    ["submitted", "completed", "completed"],
    ["submitted", "failed", "failed"],
  ] as const)("resolves %s and %s to %s", async (sessionStatus, taskStatus, expected) => {
    expect(await resolveCreativeSessionPhase(sessionStatus, taskStatus)).toBe(expected);
  });
});
