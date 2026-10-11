import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { TaskStatus } from "../web/task-store.js";
import type { CreativeSessionStatus } from "./types.js";

export type CreativeSessionPhase = CreativeSessionStatus | TaskStatus;

const SessionState = Annotation.Root({
  sessionStatus: Annotation<CreativeSessionStatus>,
  taskStatus: Annotation<TaskStatus | undefined>,
  phase: Annotation<CreativeSessionPhase>,
});

type SessionStateValue = typeof SessionState.State;
type PhaseNode = "discussion" | "proposal" | "execution";

function routeSession(state: SessionStateValue): PhaseNode {
  if (state.taskStatus) return "execution";
  return state.sessionStatus === "proposal-ready" ? "proposal" : "discussion";
}

const sessionGraph = new StateGraph(SessionState)
  .addNode("discussion", (state) => ({ phase: state.sessionStatus }))
  .addNode("proposal", () => ({ phase: "proposal-ready" as const }))
  .addNode("execution", (state) => ({ phase: state.taskStatus ?? "submitted" }))
  .addConditionalEdges(START, routeSession, {
    discussion: "discussion",
    proposal: "proposal",
    execution: "execution",
  })
  .addEdge("discussion", END)
  .addEdge("proposal", END)
  .addEdge("execution", END)
  .compile();

export async function resolveCreativeSessionPhase(
  sessionStatus: CreativeSessionStatus,
  taskStatus?: TaskStatus,
): Promise<CreativeSessionPhase> {
  const result = await sessionGraph.invoke({ sessionStatus, taskStatus, phase: sessionStatus });
  return result.phase;
}
