import { describe, expect, it } from "vitest";

import {
  OrchestralMovementPlanSchema,
  OrchestralWorkPlanSchema,
} from "../src/schema/orchestral-plan.js";
import {
  buildOrchestralLyriaPrompt,
  renderOrchestralSharedContract,
} from "../src/composer/orchestral-prompt.js";

const sharedContract = {
  tonalWorld: "D minor with restrained Phrygian color",
  identityMotif: "A rising minor second followed by a perfect fourth",
  orchestra: "Full symphonic orchestra with dark lower strings and four horns",
  acousticSpace: "Deep natural concert hall",
  dynamicLanguage: "Long waves from near-silence to one final climax",
  exclusions: ["electronic instruments", "quoted melodies"],
};

const movement = {
  order: 1,
  title: "Distant Procession",
  dramaticRole: "Introduce the shared identity without reaching a climax",
  targetDurationMinutes: 2.5,
  tempoAndMeter: "Broad 4/4 around 92 BPM",
  tonalPlan: "Establish D minor and end on an open A pedal",
  motifDevelopment: "Present fragments before revealing the complete motif",
  orchestrationArc: "Low strings and bassoon expand toward restrained horns",
  entranceContract: "Begin from silence with an open D and A",
  exitContract: "Thin to an unresolved A pedal and incomplete oboe fragment",
};

describe("orchestral plan schemas", () => {
  it("accepts a multi-movement work contract", () => {
    const plan = {
      schemaVersion: "1.0",
      title: "River to the Sea",
      intent: "A journey from a mountain spring to the open sea",
      requestedTotalDurationMinutes: null,
      plannedTotalDurationMinutes: 5,
      durationAdjustmentReason: null,
      sharedContract,
      movements: [movement, { ...movement, order: 2, title: "Open Water" }],
    };
    expect(OrchestralWorkPlanSchema.parse(plan)).toEqual(plan);
  });

  it("requires at least two movements", () => {
    expect(() => OrchestralWorkPlanSchema.parse({
      schemaVersion: "1.0",
      title: "Incomplete Work",
      intent: "Only one movement",
      requestedTotalDurationMinutes: null,
      plannedTotalDurationMinutes: 5,
      durationAdjustmentReason: null,
      sharedContract,
      movements: [movement],
    })).toThrow();
  });

  it("accepts an observable full-movement plan without chain-of-thought", () => {
    const plan = {
      schemaVersion: "1.0",
      movementOrder: 1,
      title: "Distant Procession",
      targetDurationMinutes: 2.5,
      dramaticRole: movement.dramaticRole,
      tempoAndMeter: movement.tempoAndMeter,
      tonalPlan: movement.tonalPlan,
      motifDevelopment: [movement.motifDevelopment],
      orchestrationArc: movement.orchestrationArc,
      phases: [
        { label: "Emergence", approximateDurationSeconds: 45, direction: "Reveal fragments in low strings." },
        { label: "Withdrawal", approximateDurationSeconds: 30, direction: "Return to the open pedal." },
      ],
      entranceContract: movement.entranceContract,
      exitContract: movement.exitContract,
      assumptions: [],
      lyriaPromptFormat: "orchestral-v1",
      lyriaPrompt: "Create the first movement of an original orchestral work in D minor.",
    };
    expect(OrchestralMovementPlanSchema.parse(plan)).toEqual(plan);
    expect(plan).not.toHaveProperty("chainOfThought");
  });

  it("renders every movement with one fixed prompt structure and shared contract", () => {
    const workPlan = OrchestralWorkPlanSchema.parse({
      schemaVersion: "1.0",
      title: "River to the Sea",
      intent: "A journey from a mountain spring to the open sea",
      requestedTotalDurationMinutes: null,
      plannedTotalDurationMinutes: 5,
      durationAdjustmentReason: null,
      sharedContract,
      movements: [movement, { ...movement, order: 2, title: "Open Water" }],
    });
    const draft = {
      schemaVersion: "1.0" as const,
      movementOrder: 1,
      title: movement.title,
      targetDurationMinutes: movement.targetDurationMinutes,
      dramaticRole: movement.dramaticRole,
      tempoAndMeter: movement.tempoAndMeter,
      tonalPlan: movement.tonalPlan,
      motifDevelopment: [movement.motifDevelopment],
      orchestrationArc: movement.orchestrationArc,
      phases: [
        { label: "Emergence", approximateDurationSeconds: 90, direction: "Reveal the motif." },
        { label: "Withdrawal", approximateDurationSeconds: 60, direction: "Return to the pedal." },
      ],
      entranceContract: movement.entranceContract,
      exitContract: movement.exitContract,
      assumptions: [],
    };
    const first = buildOrchestralLyriaPrompt(workPlan, draft);
    const second = buildOrchestralLyriaPrompt(workPlan, {
      ...draft,
      movementOrder: 2,
      title: "Open Water",
    });
    const headings = [
      "SHARED MUSICAL CONTRACT",
      "MOVEMENT BRIEF",
      "FORMAL TRAJECTORY",
      "CONTINUITY CONTRACT",
      "GENERATION CONSTRAINTS",
    ];

    expect(headings.map((heading) => first.indexOf(heading))).toEqual(
      [...headings.map((heading) => first.indexOf(heading))].sort((a, b) => a - b),
    );
    expect(second).toContain(renderOrchestralSharedContract(workPlan));
    expect(first).toContain(renderOrchestralSharedContract(workPlan));
    expect(first).toContain("Instrumental only, no vocals");
    expect(second).toContain("provide decisive closure");
  });

  it("adjusts an ambitious request to an eleven-minute four-movement plan", () => {
    const movements = Array.from({ length: 4 }, (_, index) => ({
      ...movement,
      order: index + 1,
      title: `Movement ${index + 1}`,
      targetDurationMinutes: 2.75,
    }));
    const plan = {
      schemaVersion: "1.0",
      title: "Compact Symphony",
      intent: "A complete four-movement arc within the supported duration",
      requestedTotalDurationMinutes: 45,
      plannedTotalDurationMinutes: 11,
      durationAdjustmentReason: "The orchestral workflow supports 5–11 minutes in total.",
      sharedContract,
      movements,
    };

    expect(OrchestralWorkPlanSchema.parse(plan)).toEqual(plan);
  });

  it("rejects a plan whose movement allocation does not match the work total", () => {
    expect(() => OrchestralWorkPlanSchema.parse({
      schemaVersion: "1.0",
      title: "Miscalculated Symphony",
      intent: "An invalid duration allocation",
      requestedTotalDurationMinutes: 11,
      plannedTotalDurationMinutes: 11,
      durationAdjustmentReason: null,
      sharedContract,
      movements: [movement, { ...movement, order: 2 }],
    })).toThrow("Movement durations must add up");
  });
});
