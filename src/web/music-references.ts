import type {
  MusicReferenceSummary,
  MusicRetrievalTrace,
  MusicRetriever,
} from "../retrieval/music-retriever.js";
import type { MusicTask } from "./task-store.js";

// The Composer records reference IDs rather than titles. The interface needs the
// titles, so a stored trace is resolved against the same local corpus.

export type MusicRetrieverLoader = () => Promise<{ retriever: MusicRetriever }>;

/** Resolves the style and standard IDs of one trace into readable references. */
export function musicReferencesForTrace(
  trace: MusicRetrievalTrace | undefined,
  retriever: MusicRetriever,
): MusicReferenceSummary[] {
  if (!trace) return [];
  const ids = [...trace.styleReferenceIds, ...trace.standardReferenceIds];
  if (!ids.length) return [];
  return retriever.findByIds(ids);
}

/**
 * Returns undefined for a task that used no music corpus, so the interface can
 * tell "no corpus" apart from "corpus chosen but nothing resolved".
 */
export async function musicReferencesForTask(
  task: Pick<MusicTask, "musicRetrieval">,
  loadRetriever: MusicRetrieverLoader,
): Promise<MusicReferenceSummary[] | undefined> {
  const trace = task.musicRetrieval;
  if (!trace) return undefined;
  try {
    const { retriever } = await loadRetriever();
    return musicReferencesForTrace(trace, retriever);
  } catch {
    // A missing or unreadable corpus must not break the task response.
    return [];
  }
}
