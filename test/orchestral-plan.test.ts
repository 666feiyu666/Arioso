import { describe, expect, it } from "vitest";

import {
  OrchestralMovementPlanSchema,
  OrchestralWorkPlanSchema,
} from "../src/schema/orchestral-plan.js";

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
      sharedContract,
      movements: [movement],
    })).toThrow();
  });

  it("accepts an observable full-movement plan without chain-of-thought", () => {
    const plan = {
      schemaVersion: "1.0",
      movementOrder: 1,
      title: "Distant Procession",
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
      lyriaPrompt: "Create the first movement of an original orchestral work in D minor.",
    };
    expect(OrchestralMovementPlanSchema.parse(plan)).toEqual(plan);
    expect(plan).not.toHaveProperty("chainOfThought");
  });
});

