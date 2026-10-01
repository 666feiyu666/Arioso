import { Agent, OpenAIProvider, Runner, run } from "@openai/agents";

import {
  OrchestralMovementPlanSchema,
  OrchestralWorkPlanSchema,
  type OrchestralMovementPlan,
  type OrchestralWorkPlan,
} from "../schema/orchestral-plan.js";
import { loadComposerSkill } from "./composer-skill.js";

const WORK_PLANNER_INSTRUCTIONS = `
You are Arioso's orchestral work planner.

Turn the user's idea into a coherent multi-movement orchestral work plan.
- Preserve the user's explicit intent and requested movement count. When no count is given, choose three or four movements.
- Treat duration as a whole-work constraint. The complete work, including every movement, must total between 5 and 11 minutes.
- Preserve an explicit requested total in requestedTotalDurationMinutes. If it is below 5 or above 11 minutes, choose the nearest supported total and explain the adjustment briefly in durationAdjustmentReason.
- Allocate 1–3 minutes to every movement. Movement target durations must add up to plannedTotalDurationMinutes within 0.25 minutes.
- Never assign the whole-work duration to an individual movement.
- Establish one shared musical contract: tonal world, original identity motif, orchestra, acoustic space, dynamic language, and exclusions.
- Give every movement a distinct dramatic purpose while keeping the work recognizably unified.
- Define audible entrance and exit contracts that make independently generated movements feel intentionally related.
- The final movement must provide closure; earlier movements may end openly when that supports continuity.
- Describe musical characteristics rather than imitating an identifiable work or artist.
- Return only the structured plan. Do not expose analysis, hidden reasoning, or implementation commentary.
`.trim();

const MOVEMENT_COMPOSER_INSTRUCTIONS = `
You are Arioso's orchestral movement composer.

Develop one complete movement from an approved orchestral work plan.
- Treat the shared contract and the selected movement outline as authoritative.
- Copy the selected outline's 1–3 minute target into targetDurationMinutes and design only that amount of music.
- Design a complete movement-scale trajectory through motif, harmony, orchestration, texture, rhythm, register, dynamics, and transitions.
- Honor the entrance and exit contracts. A non-final movement may remain open; a final movement must close the complete work.
- The Lyria prompt must stand alone because audio generations do not share hidden state. Repeat the essential shared identity and continuity cues inside it.
- Keep the music purely instrumental unless the shared contract explicitly permits wordless choir as orchestral color.
- Do not quote or closely imitate an identifiable composition, arrangement, or recording.
- Return only the structured movement plan. Do not expose analysis, hidden reasoning, or implementation commentary.
`.trim();

export interface OrchestralAgentOptions {
  apiKey?: string;
  model?: string;
  lyriaModel?: string;
}

async function runAgent<T>(
  agent: Agent<unknown, any>,
  input: string,
  apiKey?: string,
): Promise<T> {
  const provider = apiKey ? new OpenAIProvider({ apiKey }) : undefined;
  try {
    const result = apiKey && provider
      ? await new Runner({ modelProvider: provider, tracing: { apiKey } }).run(agent, input)
      : await run(agent, input);
    if (!result.finalOutput) {
      throw new Error("The orchestral agent returned no structured plan.");
    }
    return result.finalOutput as T;
  } finally {
    await provider?.close();
  }
}

export async function planOrchestralWork(
  description: string,
  options: OrchestralAgentOptions = {},
): Promise<OrchestralWorkPlan> {
  const input = description.trim();
  if (!input) throw new Error("An orchestral work description is required.");

  const skill = await loadComposerSkill("orchestral");
  const agent = new Agent({
    name: "Arioso Orchestral Work Planner",
    instructions: [
      WORK_PLANNER_INSTRUCTIONS,
      `Target Lyria model: ${options.lyriaModel ?? process.env.LYRIA_MODEL ?? "lyria-3.5"}`,
      skill,
    ].join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: OrchestralWorkPlanSchema,
  });

  const result = await runAgent<OrchestralWorkPlan>(agent, input, options.apiKey);
  return OrchestralWorkPlanSchema.parse(result);
}

export async function composeOrchestralMovement(
  workPlan: OrchestralWorkPlan,
  movementOrder: number,
  options: OrchestralAgentOptions = {},
): Promise<OrchestralMovementPlan> {
  const outline = workPlan.movements.find((movement) => movement.order === movementOrder);
  if (!outline) throw new Error(`Unknown orchestral movement: ${movementOrder}`);

  const skill = await loadComposerSkill("orchestral");
  const agent = new Agent({
    name: "Arioso Orchestral Movement Composer",
    instructions: [
      MOVEMENT_COMPOSER_INSTRUCTIONS,
      `Target Lyria model: ${options.lyriaModel ?? process.env.LYRIA_MODEL ?? "lyria-3.5"}`,
      skill,
    ].join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: OrchestralMovementPlanSchema,
  });

  const input = [
    "Complete orchestral work plan:",
    JSON.stringify(workPlan, null, 2),
    `\nDevelop only movement ${movementOrder}: ${outline.title}. Its complete target duration is ${outline.targetDurationMinutes} minutes, not the duration of the whole work.`,
  ].join("\n");
  const result = await runAgent<OrchestralMovementPlan>(agent, input, options.apiKey);
  return OrchestralMovementPlanSchema.parse(result);
}
