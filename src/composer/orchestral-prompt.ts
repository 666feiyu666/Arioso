import type {
  OrchestralMovementPlan,
  OrchestralWorkPlan,
} from "../schema/orchestral-plan.js";

export const ORCHESTRAL_PROMPT_FORMAT = "orchestral-v1" as const;

function section(title: string, lines: readonly string[]): string {
  return [title, ...lines.map((line) => `- ${line}`)].join("\n");
}

export function renderOrchestralSharedContract(workPlan: OrchestralWorkPlan): string {
  const contract = workPlan.sharedContract;
  return section("SHARED MUSICAL CONTRACT", [
    `Work title: ${workPlan.title}`,
    `Whole-work intent: ${workPlan.intent}`,
    `Tonal world: ${contract.tonalWorld}`,
    `Original identity motif: ${contract.identityMotif}`,
    `Orchestra: ${contract.orchestra}`,
    `Acoustic space: ${contract.acousticSpace}`,
    `Dynamic language: ${contract.dynamicLanguage}`,
    `Exclusions: ${contract.exclusions.length ? contract.exclusions.join("; ") : "none specified"}`,
  ]);
}

export function buildOrchestralLyriaPrompt(
  workPlan: OrchestralWorkPlan,
  movementPlan: Omit<OrchestralMovementPlan, "lyriaPrompt" | "lyriaPromptFormat">,
): string {
  const outline = workPlan.movements.find(
    (movement) => movement.order === movementPlan.movementOrder,
  );
  if (!outline) {
    throw new Error(`Unknown orchestral movement: ${movementPlan.movementOrder}`);
  }

  const isFinal = movementPlan.movementOrder === workPlan.movements.length;
  const phases = movementPlan.phases.map((phase, index) => {
    const duration = phase.approximateDurationSeconds === null
      ? "duration determined by the musical arc"
      : `approximately ${phase.approximateDurationSeconds} seconds`;
    return `${index + 1}. ${phase.label} (${duration}): ${phase.direction}`;
  });

  return [
    "Create one complete movement of an original multi-movement orchestral work. The generation is independent, so follow every shared identity and continuity instruction below. Do not quote, reproduce, or closely imitate any identifiable composition, arrangement, or recording.",
    renderOrchestralSharedContract(workPlan),
    section("MOVEMENT BRIEF", [
      `Movement: ${movementPlan.movementOrder} of ${workPlan.movements.length} — ${movementPlan.title}`,
      `Dramatic role: ${movementPlan.dramaticRole}`,
      `Target duration: approximately ${movementPlan.targetDurationMinutes} minutes`,
      `Tempo and meter: ${movementPlan.tempoAndMeter}`,
      `Tonal plan: ${movementPlan.tonalPlan}`,
      `Outline motif development: ${outline.motifDevelopment}`,
      `Detailed motif development: ${movementPlan.motifDevelopment.join("; ")}`,
      `Orchestration arc: ${movementPlan.orchestrationArc}`,
    ]),
    section("FORMAL TRAJECTORY", phases),
    section("CONTINUITY CONTRACT", [
      `Entrance: ${movementPlan.entranceContract}`,
      `Exit: ${movementPlan.exitContract}`,
      isFinal
        ? "Whole-work function: provide decisive closure for the complete work."
        : "Whole-work function: preserve the stated exit relationship for the following independently generated movement.",
    ]),
    section("GENERATION CONSTRAINTS", [
      "Instrumental only, no vocals, spoken words, or lyrical text, unless the shared contract explicitly permits wordless choir solely as orchestral color.",
      "Preserve the shared orchestra and acoustic space throughout this movement.",
      "Treat the target duration as the complete duration of this movement, not the whole work.",
      "Produce a complete audible movement with the stated entrance, internal arc, and exit.",
    ]),
  ].join("\n\n");
}
