import { z } from "zod";

export const OrchestralMovementOutlineSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  dramaticRole: z.string().min(1),
  targetDurationMinutes: z.number().positive().max(10),
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
  sharedContract: z.object({
    tonalWorld: z.string().min(1),
    identityMotif: z.string().min(1),
    orchestra: z.string().min(1),
    acousticSpace: z.string().min(1),
    dynamicLanguage: z.string().min(1),
    exclusions: z.array(z.string()),
  }),
  movements: z.array(OrchestralMovementOutlineSchema).min(2).max(6),
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
  dramaticRole: z.string().min(1),
  tempoAndMeter: z.string().min(1),
  tonalPlan: z.string().min(1),
  motifDevelopment: z.array(z.string()).min(1),
  orchestrationArc: z.string().min(1),
  phases: z.array(OrchestralMovementPhaseSchema).min(2),
  entranceContract: z.string().min(1),
  exitContract: z.string().min(1),
  assumptions: z.array(z.string()),
  lyriaPrompt: z.string().min(1),
});

export type OrchestralWorkPlan = z.infer<typeof OrchestralWorkPlanSchema>;
export type OrchestralMovementPlan = z.infer<typeof OrchestralMovementPlanSchema>;

