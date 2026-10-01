import { z } from "zod";

export const OrchestralMovementOutlineSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  dramaticRole: z.string().min(1),
  targetDurationMinutes: z.number().min(1).max(3).describe(
    "Target duration for this movement. One movement must fit one Lyria 3.5 generation unit.",
  ),
  tempoAndMeter: z.string().min(1),
  tonalPlan: z.string().min(1),
  motifDevelopment: z.string().min(1),
  orchestrationArc: z.string().min(1),
  entranceContract: z.string().min(1),
  exitContract: z.string().min(1),
});

export const OrchestralWorkPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  title: z.string().min(1),
  intent: z.string().min(1),
  requestedTotalDurationMinutes: z.number().positive().nullable().describe(
    "The total duration explicitly requested by the user, or null when none was supplied.",
  ),
  plannedTotalDurationMinutes: z.number().min(5).max(11).describe(
    "Supported total duration for the complete multi-movement work.",
  ),
  durationAdjustmentReason: z.string().min(1).nullable().describe(
    "Why an explicit duration was adjusted to the supported 5–11 minute range, or null.",
  ),
  sharedContract: z.object({
    tonalWorld: z.string().min(1),
    identityMotif: z.string().min(1),
    orchestra: z.string().min(1),
    acousticSpace: z.string().min(1),
    dynamicLanguage: z.string().min(1),
    exclusions: z.array(z.string()),
  }),
  movements: z.array(OrchestralMovementOutlineSchema).min(2).max(6),
}).superRefine((plan, context) => {
  const orders = plan.movements.map((movement) => movement.order);
  const expectedOrders = plan.movements.map((_, index) => index + 1);
  if (orders.some((order, index) => order !== expectedOrders[index])) {
    context.addIssue({
      code: "custom",
      path: ["movements"],
      message: "Movement order must be contiguous and start at 1.",
    });
  }

  const allocated = plan.movements.reduce(
    (total, movement) => total + movement.targetDurationMinutes,
    0,
  );
  if (Math.abs(allocated - plan.plannedTotalDurationMinutes) > 0.25) {
    context.addIssue({
      code: "custom",
      path: ["plannedTotalDurationMinutes"],
      message: "Movement durations must add up to the planned total duration.",
    });
  }

  const requested = plan.requestedTotalDurationMinutes;
  const adjusted = requested !== null
    && (requested < 5 || requested > 11 || Math.abs(requested - plan.plannedTotalDurationMinutes) > 0.5);
  if (adjusted && !plan.durationAdjustmentReason) {
    context.addIssue({
      code: "custom",
      path: ["durationAdjustmentReason"],
      message: "A duration adjustment reason is required when the requested total is changed.",
    });
  }
});

export const OrchestralMovementPhaseSchema = z.object({
  label: z.string().min(1),
  approximateDurationSeconds: z.number().int().positive().nullable(),
  direction: z.string().min(1),
});

export const OrchestralMovementPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  movementOrder: z.number().int().positive(),
  title: z.string().min(1),
  targetDurationMinutes: z.number().min(1).max(3),
  dramaticRole: z.string().min(1),
  tempoAndMeter: z.string().min(1),
  tonalPlan: z.string().min(1),
  motifDevelopment: z.array(z.string()).min(1),
  orchestrationArc: z.string().min(1),
  phases: z.array(OrchestralMovementPhaseSchema).min(2),
  entranceContract: z.string().min(1),
  exitContract: z.string().min(1),
  assumptions: z.array(z.string()),
  lyriaPromptFormat: z.literal("orchestral-v1"),
  lyriaPrompt: z.string().min(1),
});

export const OrchestralMovementDraftSchema = OrchestralMovementPlanSchema.omit({
  lyriaPromptFormat: true,
  lyriaPrompt: true,
});

export type OrchestralWorkPlan = z.infer<typeof OrchestralWorkPlanSchema>;
export type OrchestralMovementPlan = z.infer<typeof OrchestralMovementPlanSchema>;
export type OrchestralMovementDraft = z.infer<typeof OrchestralMovementDraftSchema>;
