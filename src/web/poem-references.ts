import type { PoemReference } from "../discussion/types.js";
import {
  buildPoemQuery,
  loadMoodLexicon,
  loadPoemRetriever,
  type MoodLexicon,
  type PoemRetriever,
} from "../retrieval/poem-retriever.js";
import type { MoodChat, PoemRetrievalTrace } from "./mood-chat-store.js";

// Poetry retrieval is a bounded preprocessing step for the proposal only. It
// never blocks the Director: every failure becomes an advisory trace entry.

const MAX_REFERENCES = 3;
const MAX_REASON_LENGTH = 240;

export interface PoemProposalReferences {
  references: PoemReference[];
  trace: PoemRetrievalTrace;
}

export interface PoemProposalDependencies {
  /** Injected retriever, mainly for tests and for disabling the corpus. */
  loadRetriever?: () => Promise<PoemRetriever>;
  lexicon?: MoodLexicon;
  now?: () => Date;
}

let cachedRetriever: Promise<PoemRetriever> | undefined;

function defaultRetriever(): Promise<PoemRetriever> {
  cachedRetriever ??= loadPoemRetriever()
    .then((loaded) => loaded.retriever)
    .catch((error: unknown) => {
      // A missing or corrupt corpus must not poison later attempts.
      cachedRetriever = undefined;
      throw error;
    });
  return cachedRetriever;
}

function traceWithoutReferences(
  retrievedAt: string,
  query: string,
  unavailableReason: string,
): PoemRetrievalTrace {
  return {
    query,
    corpus_version: "",
    references: [],
    retrieved_at: retrievedAt,
    unavailable_reason: unavailableReason.slice(0, MAX_REASON_LENGTH),
  };
}

/**
 * Builds the retrieval query from every user-authored message and the latest
 * Director mood, then returns at most three complete poems plus their trace.
 */
export async function poemReferencesForProposal(
  chat: MoodChat,
  dependencies: PoemProposalDependencies = {},
): Promise<PoemProposalReferences> {
  const retrievedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const userMessages = chat.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const mood = [...chat.messages].reverse().find((message) => message.mood)?.mood;

  let query = "";
  try {
    const lexicon = dependencies.lexicon ?? await loadMoodLexicon();
    query = buildPoemQuery({ userMessages, mood }, lexicon);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[poem-retrieval] mood lexicon unavailable: ${reason.slice(0, MAX_REASON_LENGTH)}`);
    return {
      references: [],
      trace: traceWithoutReferences(retrievedAt, query, `mood_lexicon_unavailable: ${reason}`),
    };
  }
  if (!query) {
    return {
      references: [],
      trace: traceWithoutReferences(retrievedAt, "", "empty_query"),
    };
  }

  try {
    const retriever = dependencies.loadRetriever
      ? await dependencies.loadRetriever()
      : await defaultRetriever();
    const references = retriever.retrieve(query, MAX_REFERENCES);
    return {
      references,
      trace: {
        query,
        corpus_version: retriever.corpusVersion,
        references: references.map((reference) => ({
          id: reference.id,
          title: reference.title,
          author: reference.author,
          score: reference.score,
          matched_terms: reference.matchedTerms,
        })),
        retrieved_at: retrievedAt,
      },
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[poem-retrieval] corpus unavailable: ${reason.slice(0, MAX_REASON_LENGTH)}`);
    return {
      references: [],
      trace: traceWithoutReferences(retrievedAt, query, `corpus_unavailable: ${reason}`),
    };
  }
}
