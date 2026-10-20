import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { JourneyPhase, MusicJourney } from "./types.js";

/**
 * The Journey graph. It is deliberately one bounded workflow rather than a
 * coordinator: each phase is a node, each human gate or background completion
 * is an event, and only the transitions drawn here are legal. The graph owns
 * validated state transitions; the runtime owns the side effects (creating
 * tasks, dispatching generation) and persists every resulting phase.
 */

export type JourneyEvent =
  | { type: "song-submitted" }
  | { type: "song-reviewing" }
  | { type: "song-kept" }
  | { type: "song-regenerating" }
  | { type: "song-failed"; error?: string }
  | { type: "continue-album"; songTaskId: string }
  | { type: "plan-ready"; albumTaskId: string }
  | { type: "plan-revised" }
  | { type: "plan-approved"; revision: number }
  | { type: "album-complete" }
  | { type: "album-failed"; error?: string }
  | { type: "retry"; resume: "song-running" | "album-planning" | "album-running" }
  | { type: "finish" };

export type JourneyEventType = JourneyEvent["type"];

export interface JourneyTransition {
  phase: JourneyPhase;
  /** A number approves that plan revision; null invalidates any approval. */
  approvedPlanRevision?: number | null;
  error?: string | null;
}

export class JourneyTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JourneyTransitionError";
  }
}

interface Edge {
  phase: JourneyPhase;
  approvedPlanRevision?: number | null;
  error?: string | null;
}

function edge(phase: JourneyPhase, extra: Partial<Edge> = {}): Edge {
  return { phase, ...extra };
}

/** Every legal move, keyed by the phase the journey is in. */
const TRANSITIONS: Record<JourneyPhase, Partial<Record<JourneyEventType, (event: JourneyEvent) => Edge>>> = {
  mood: {
    "song-submitted": () => edge("song-running"),
  },
  "song-running": {
    "song-submitted": () => edge("song-running"),
    "song-reviewing": () => edge("song-review"),
    "song-kept": () => edge("song-ready"),
    "song-regenerating": () => edge("song-running"),
    "song-failed": (event) => edge("failed", { error: event.type === "song-failed" ? event.error ?? null : null }),
  },
  "song-review": {
    "song-reviewing": () => edge("song-review"),
    "song-kept": () => edge("song-ready"),
    "song-regenerating": () => edge("song-running"),
    "song-failed": (event) => edge("failed", { error: event.type === "song-failed" ? event.error ?? null : null }),
  },
  "song-ready": {
    "song-kept": () => edge("song-ready"),
    "song-submitted": () => edge("song-running", { approvedPlanRevision: null }),
    "continue-album": () => edge("album-planning", { approvedPlanRevision: null }),
    "song-regenerating": () => edge("song-running"),
    finish: () => edge("completed"),
  },
  "album-planning": {
    "plan-ready": () => edge("album-review"),
    "plan-revised": () => edge("album-planning", { approvedPlanRevision: null }),
    // A plan that went straight to finished audio still lands in curation.
    "album-complete": () => edge("album-curation"),
    "album-failed": (event) => edge("failed", { error: event.type === "album-failed" ? event.error ?? null : null }),
  },
  "album-review": {
    "plan-revised": () => edge("album-planning", { approvedPlanRevision: null }),
    "plan-approved": (event) => edge("album-running", {
      approvedPlanRevision: event.type === "plan-approved" ? event.revision : null,
    }),
    "album-complete": () => edge("album-curation"),
    "album-failed": (event) => edge("failed", { error: event.type === "album-failed" ? event.error ?? null : null }),
  },
  "album-running": {
    "plan-approved": (event) => edge("album-running", {
      approvedPlanRevision: event.type === "plan-approved" ? event.revision : null,
    }),
    "album-complete": () => edge("album-curation"),
    "album-failed": (event) => edge("failed", { error: event.type === "album-failed" ? event.error ?? null : null }),
  },
  "album-curation": {
    "album-complete": () => edge("album-curation"),
    finish: () => edge("completed"),
    "album-failed": (event) => edge("failed", { error: event.type === "album-failed" ? event.error ?? null : null }),
  },
  completed: {
    finish: () => edge("completed"),
  },
  failed: {
    "song-submitted": () => edge("song-running", { approvedPlanRevision: null, error: null }),
    retry: (event) => edge(event.type === "retry" ? event.resume : "song-running", {
      approvedPlanRevision: null,
      error: null,
    }),
  },
};

const NODE_FOR_PHASE: Record<JourneyPhase, string> = {
  mood: "mood",
  "song-running": "songRunning",
  "song-review": "songReview",
  "song-ready": "songReady",
  "album-planning": "albumPlanning",
  "album-review": "albumReview",
  "album-running": "albumRunning",
  "album-curation": "albumCuration",
  completed: "completed",
  failed: "failed",
};
const JourneyState = Annotation.Root({
  journey: Annotation<MusicJourney>,
  event: Annotation<JourneyEvent>,
  outcome: Annotation<JourneyTransition | null>({
    reducer: (_previous, next) => next,
    default: () => null,
  }),
});

type JourneyStateValue = typeof JourneyState.State;

function transitionNode(phase: JourneyPhase) {
  return (state: JourneyStateValue) => {
    const move = TRANSITIONS[phase][state.event.type];
    if (!move) {
      throw new JourneyTransitionError(
        `Cannot apply "${state.event.type}" while the journey is in "${phase}".`,
      );
    }
    return { outcome: move(state.event) };
  };
}

// Node names are written out explicitly: the graph's node-name type is
// accumulated by addNode, so a loop over strings would erase it.
const journeyGraphBuilder = new StateGraph(JourneyState)
  .addNode("route", () => ({}))
  .addNode("mood", transitionNode("mood"))
  .addNode("songRunning", transitionNode("song-running"))
  .addNode("songReview", transitionNode("song-review"))
  .addNode("songReady", transitionNode("song-ready"))
  .addNode("albumPlanning", transitionNode("album-planning"))
  .addNode("albumReview", transitionNode("album-review"))
  .addNode("albumRunning", transitionNode("album-running"))
  .addNode("albumCuration", transitionNode("album-curation"))
  .addNode("completed", transitionNode("completed"))
  .addNode("failed", transitionNode("failed"))
  .addEdge(START, "route")
  .addConditionalEdges("route", (state: JourneyStateValue) => NODE_FOR_PHASE[state.journey.phase], {
    mood: "mood",
    songRunning: "songRunning",
    songReview: "songReview",
    songReady: "songReady",
    albumPlanning: "albumPlanning",
    albumReview: "albumReview",
    albumRunning: "albumRunning",
    albumCuration: "albumCuration",
    completed: "completed",
    failed: "failed",
  })
  .addEdge("mood", END)
  .addEdge("songRunning", END)
  .addEdge("songReview", END)
  .addEdge("songReady", END)
  .addEdge("albumPlanning", END)
  .addEdge("albumReview", END)
  .addEdge("albumRunning", END)
  .addEdge("albumCuration", END)
  .addEdge("completed", END)
  .addEdge("failed", END);

export const journeyGraph = journeyGraphBuilder.compile();

/** Validate one event against the journey's current phase. */
export async function transitionJourney(
  journey: MusicJourney,
  event: JourneyEvent,
): Promise<JourneyTransition> {
  const result = await journeyGraph.invoke({ journey, event, outcome: null });
  if (!result.outcome) throw new JourneyTransitionError("The journey graph produced no transition.");
  return result.outcome;
}
