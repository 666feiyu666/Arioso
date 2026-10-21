import type { PoemReference } from "../discussion/types.js";
import {
  buildPoemQuery,
  hashPoemQuery,
  loadMoodLexicon,
  loadPoemRetriever,
  type MoodLexicon,
  type PoemRetriever,
} from "../retrieval/poem-retriever.js";
import type { MoodChat, PoemRetrievalTrace } from "./mood-chat-store.js";

// Poetry retrieval is a bounded preprocessing step for a Director turn. It never
// blocks the Director: every failure becomes an advisory trace entry.

const MAX_REFERENCES = 3;
const MAX_REASON_LENGTH = 240;

export interface PoemChatReferences {
  references: PoemReference[];
  trace: PoemRetrievalTrace;
  /** True when the stored trace still matched the current context. */
  reused: boolean;
}

export interface PoemReferenceDependencies {
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
  queryHash: string,
  unavailableReason: string,
): PoemRetrievalTrace {
  return {
    query,
    query_hash: queryHash,
    corpus_version: "",
    references: [],
    retrieved_at: retrievedAt,
    unavailable_reason: unavailableReason.slice(0, MAX_REASON_LENGTH),
  };
}

/**
 * Re-read the poems behind a stored trace. Returns undefined when the trace
 * cannot be reproduced from the current corpus, so the caller retrieves again.
 */
function reusedReferences(
  chat: MoodChat,
  queryHash: string,
  retriever: PoemRetriever,
): PoemChatReferences | undefined {
  const trace = chat.poem_retrieval;
  if (!trace?.query_hash || trace.query_hash !== queryHash) return undefined;
  if (trace.corpus_version !== retriever.corpusVersion || !trace.references.length) return undefined;
  try {
    const records = retriever.findByIds(trace.references.map((reference) => reference.id));
    if (records.length !== trace.references.length) return undefined;
    const byId = new Map(records.map((record) => [record.id, record]));
    const references: PoemReference[] = [];
    for (const reference of trace.references) {
      const record = byId.get(reference.id);
      if (!record) return undefined;
      references.push({ ...record, score: reference.score, matchedTerms: reference.matched_terms });
    }
    return { references, trace, reused: true };
  } catch {
    // An unreadable corpus just means the reference data is retrieved again.
    return undefined;
  }
}

/**
 * Builds the retrieval query from every user-authored message and the latest
 * Director mood, then returns at most three complete poems plus their trace.
 * An unchanged query with the same corpus version reuses the stored trace.
 */
export async function poemReferencesForChat(
  chat: MoodChat,
  dependencies: PoemReferenceDependencies = {},
): Promise<PoemChatReferences> {
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
      reused: false,
      trace: traceWithoutReferences(retrievedAt, query, "", `mood_lexicon_unavailable: ${reason}`),
    };
  }
  const queryHash = hashPoemQuery(query);
  if (!query) {
    return {
      references: [],
      reused: false,
      trace: traceWithoutReferences(retrievedAt, "", queryHash, "empty_query"),
    };
  }

  let retriever: PoemRetriever;
  try {
    retriever = dependencies.loadRetriever
      ? await dependencies.loadRetriever()
      : await defaultRetriever();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[poem-retrieval] corpus unavailable: ${reason.slice(0, MAX_REASON_LENGTH)}`);
    return {
      references: [],
      reused: false,
      trace: traceWithoutReferences(retrievedAt, query, queryHash, `corpus_unavailable: ${reason}`),
    };
  }

  const reused = reusedReferences(chat, queryHash, retriever);
  if (reused) return reused;

  let references: PoemReference[];
  try {
    references = retriever.retrieve(query, MAX_REFERENCES);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[poem-retrieval] retrieval failed: ${reason.slice(0, MAX_REASON_LENGTH)}`);
    return {
      references: [],
      reused: false,
      trace: traceWithoutReferences(retrievedAt, query, queryHash, `corpus_unavailable: ${reason}`),
    };
  }
  return {
    references,
    reused: false,
    trace: {
      query,
      query_hash: queryHash,
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
}
