import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

// Deterministic TF-IDF retrieval over the modern-poetry corpus. It is separate
// from the Jazz retriever because Chinese poetry needs character n-grams rather
// than Latin word tokens, and because this experiment must be easy to remove
// without touching the tested Jazz behaviour.

export interface NormalizedPoemRecord {
  schema_version: string;
  id: string;
  title: string;
  author: string;
  date: string | null;
  /** Full source poem, original line breaks preserved. */
  text: string;
  /** Derived retrieval field; never replaces the source wording. */
  search_text: string;
  matched_mood_cues: string[];
  source: {
    repository: string;
    commit: string;
    path: string;
  };
}

export interface RetrievedPoemReference {
  id: string;
  title: string;
  author: string;
  text: string;
  score: number;
  matchedTerms: string[];
}

export interface MoodLexicon {
  version: string;
  categories: Record<string, string[]>;
  singleCharacterTokens: string[];
  stopTerms: string[];
}

export interface PoemQueryInput {
  /** Every user-authored discussion message, oldest first. */
  userMessages: string[];
  mood?: { label: string; imagery: string } | undefined;
}

export interface PoemRetriever {
  readonly corpusVersion: string;
  retrieve(query: string, limit?: number): RetrievedPoemReference[];
  /** Re-read the complete poems behind stored reference IDs, in that order. */
  findByIds(ids: string[]): RetrievedPoemReference[];
}

const MAX_REFERENCES = 3;
const MAX_MATCHED_TERMS = 8;
const CUE_WEIGHT = 3;
const TITLE_WEIGHT = 2;
const TEXT_WEIGHT = 1;
/**
 * Calibrated against the fixed Director evaluation set in
 * `test/poem-retriever.test.ts`: ordinary emotional turns score well above this
 * while a generic phrase such as `感到` or `帮我做一首歌` stays below it. A weak
 * overlap on filler vocabulary must not be enough to supply a poem.
 */
export const MIN_POEM_RELEVANCE = 0.045;

const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu;
const LATIN_WORD = /[a-z0-9]+(?:'[a-z0-9]+)?/gu;

/**
 * Lightweight English inflection stripping for retrieval only. It maps common
 * inflections onto a shared stem (`walking` -> `walk`) so an English query
 * reaches the same term as the poem text; it is deliberately not a
 * linguistically correct stemmer. Numbers are left untouched.
 */
function stemLatin(word: string): string {
  if (/^[0-9]+$/u.test(word)) return word;
  const lower = word.toLowerCase();
  let base = lower;
  if (base.endsWith("'s") || base.endsWith("s'")) base = base.slice(0, -2);
  const rules: [string, string][] = [
    ["ies", "y"],
    ["ied", "y"],
    ["iest", "y"],
    ["iness", "y"],
    ["ingly", ""],
    ["edly", ""],
    ["ing", ""],
    ["ed", ""],
    ["ly", ""],
    ["ment", ""],
    ["ness", ""],
    ["tion", ""],
    ["sion", ""],
    ["est", ""],
    ["er", ""],
    ["es", ""],
    ["s", ""],
  ];
  for (const [suffix, replacement] of rules) {
    if (base.length - suffix.length >= 3 && base.endsWith(suffix)) {
      return base.slice(0, -suffix.length) + replacement;
    }
  }
  return base;
}

const PoemRecordSchema = z.object({
  schema_version: z.string(),
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  date: z.string().nullable(),
  text: z.string().min(1),
  search_text: z.string().min(1),
  matched_mood_cues: z.array(z.string()),
  source: z.object({
    repository: z.string(),
    commit: z.string(),
    path: z.string(),
  }),
}).passthrough();

const MoodLexiconSchema = z.object({
  version: z.string(),
  categories: z.record(z.string(), z.array(z.string())),
  single_character_tokens: z.array(z.string()).default([]),
  stop_terms: z.array(z.string()).default([]),
});

interface IndexedDocument {
  record: NormalizedPoemRecord;
  weights: Map<string, number>;
  magnitude: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function magnitude(weights: Map<string, number>): number {
  return Math.sqrt([...weights.values()].reduce((sum, weight) => sum + weight ** 2, 0));
}

/** Logarithmic term frequency against the corpus IDF. */
function weightsFor(
  counts: Map<string, number>,
  inverseDocumentFrequency: Map<string, number>,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [term, count] of counts) {
    const idf = inverseDocumentFrequency.get(term);
    if (idf !== undefined) weights.set(term, (1 + Math.log(count)) * idf);
  }
  return weights;
}

/**
 * Character bigrams and trigrams carry Chinese phrasing without a segmenter;
 * Latin words and numbers reuse the existing word-token rules. Single characters
 * only survive for a small allowlist of imagery terms.
 */
export function tokenizePoemText(value: string, lexicon: MoodLexicon): string[] {
  const normalized = value.normalize("NFKC").toLowerCase();
  const stops = new Set(lexicon.stopTerms);
  const allowedSingles = new Set(lexicon.singleCharacterTokens);
  const tokens: string[] = [];

  for (const match of normalized.matchAll(LATIN_WORD)) {
    const token = stemLatin(match[0]);
    if (token.length > 1 && !stops.has(token) && !stops.has(match[0])) tokens.push(token);
  }
  for (const match of normalized.matchAll(CJK_RUN)) {
    const run = match[0];
    for (const size of [2, 3]) {
      for (let index = 0; index + size <= run.length; index += 1) {
        const token = run.slice(index, index + size);
        if (!stops.has(token)) tokens.push(token);
      }
    }
    for (const character of run) {
      if (allowedSingles.has(character)) tokens.push(character);
    }
  }
  return tokens;
}

function countCueOccurrences(haystack: string, cue: string): number {
  if (/^[a-z][a-z ]*$/u.test(cue)) {
    const pattern = new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "gu");
    return (haystack.match(pattern) ?? []).length;
  }
  let count = 0;
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(cue, from);
    if (found === -1) return count;
    count += 1;
    from = found + cue.length;
  }
}

/**
 * Bilingual expansions for the mood vocabulary already used by MoodMic. A cue
 * that appears in the text pulls in its whole category, which bridges English
 * user input and Chinese corpus text. These are retrieval hints, never a verdict
 * about what the poem means.
 */
export function moodExpansions(text: string, lexicon: MoodLexicon): string[] {
  const haystack = text.normalize("NFKC").toLowerCase();
  const expansions = new Set<string>();
  for (const cues of Object.values(lexicon.categories)) {
    const hit = cues.some((cue) => cue.length > 1 && countCueOccurrences(haystack, cue) > 0);
    if (!hit) continue;
    for (const cue of cues) expansions.add(cue);
  }
  return [...expansions].sort();
}

/** Query from all user-authored messages plus the latest Director mood. */
export function buildPoemQuery(input: PoemQueryInput, lexicon: MoodLexicon): string {
  const parts = [
    ...input.userMessages,
    input.mood?.label ?? "",
    input.mood?.imagery ?? "",
  ].map((part) => part.trim()).filter(Boolean);
  const base = parts.join(" \n ").replace(/\s+/gu, " ").trim();
  if (!base) return "";
  return [base, ...moodExpansions(base, lexicon)].join(" ");
}

/**
 * Deterministic identity of a retrieval query. A stored trace may be reused only
 * while both this hash and the corpus version are unchanged.
 */
export function hashPoemQuery(query: string): string {
  return sha256(query.trim());
}

export interface CreatePoemRetrieverOptions {
  /** Corpus checksum or manifest version recorded with each retrieval trace. */
  corpusVersion?: string | undefined;
  lexicon: MoodLexicon;
  /** Minimum cosine similarity for a reference to count; defaults to the calibrated floor. */
  minRelevance?: number | undefined;
}

export function createPoemRetriever(
  records: NormalizedPoemRecord[],
  options: CreatePoemRetrieverOptions,
): PoemRetriever {
  const { lexicon } = options;
  const searchable = records.filter((record) => record.text.trim() && record.search_text.trim());
  const documentTokens = searchable.map((record) => {
    const counts = new Map<string, number>();
    const add = (tokens: string[], weight: number) => {
      for (const [term, count] of termCounts(tokens)) {
        counts.set(term, (counts.get(term) ?? 0) + count * weight);
      }
    };
    add(tokenizePoemText(record.matched_mood_cues.join(" "), lexicon), CUE_WEIGHT);
    add(tokenizePoemText(record.title, lexicon), TITLE_WEIGHT);
    add(tokenizePoemText(record.search_text, lexicon), TEXT_WEIGHT);
    return counts;
  });

  const documentFrequency = new Map<string, number>();
  for (const counts of documentTokens) {
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([term, frequency]) => [
      term,
      Math.log((searchable.length + 1) / (frequency + 1)) + 1,
    ]),
  );

  const documents: IndexedDocument[] = searchable.map((record, index) => {
    const weights = weightsFor(documentTokens[index] ?? new Map(), inverseDocumentFrequency);
    return { record, weights, magnitude: magnitude(weights) };
  });
  const documentsById = new Map(documents.map((document) => [document.record.id, document]));

  const corpusVersion = options.corpusVersion ?? sha256(
    records.map((record) => `${record.id}:${record.source.commit}`).join("\n"),
  );
  const minRelevance = options.minRelevance ?? MIN_POEM_RELEVANCE;

  return {
    corpusVersion,
    retrieve(query: string, limit = MAX_REFERENCES): RetrievedPoemReference[] {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_REFERENCES));
      const queryTokens = tokenizePoemText(query, lexicon);
      const queryWeights = weightsFor(termCounts(queryTokens), inverseDocumentFrequency);
      const queryMagnitude = magnitude(queryWeights);
      if (!queryWeights.size || queryMagnitude === 0) return [];

      const scored = documents
        .map((document) => {
          let dotProduct = 0;
          const matchedTerms: { term: string; weight: number }[] = [];
          for (const [term, queryWeight] of queryWeights) {
            const documentWeight = document.weights.get(term);
            if (documentWeight === undefined) continue;
            dotProduct += queryWeight * documentWeight;
            matchedTerms.push({ term, weight: queryWeight * documentWeight });
          }
          matchedTerms.sort((left, right) =>
            right.weight - left.weight || left.term.localeCompare(right.term));
          return {
            record: document.record,
            score: document.magnitude === 0
              ? 0
              : dotProduct / (queryMagnitude * document.magnitude),
            matchedTerms: matchedTerms.map((entry) => entry.term).slice(0, MAX_MATCHED_TERMS),
          };
        })
        .filter((entry) => entry.score >= minRelevance)
        // Ties fall back to stable record IDs, never to enumeration order.
        .sort((left, right) =>
          right.score - left.score || left.record.id.localeCompare(right.record.id));

      const references: RetrievedPoemReference[] = [];
      const authors = new Set<string>();
      for (const entry of scored) {
        if (references.length >= safeLimit) break;
        // At most one poem per author keeps the references varied.
        if (authors.has(entry.record.author)) continue;
        authors.add(entry.record.author);
        references.push({
          id: entry.record.id,
          title: entry.record.title,
          author: entry.record.author,
          text: entry.record.text,
          score: Number(entry.score.toFixed(6)),
          matchedTerms: entry.matchedTerms,
        });
      }
      return references;
    },

    findByIds(ids: string[]): RetrievedPoemReference[] {
      const references: RetrievedPoemReference[] = [];
      for (const id of ids) {
        const document = documentsById.get(id);
        if (!document) continue;
        references.push({
          id: document.record.id,
          title: document.record.title,
          author: document.record.author,
          text: document.record.text,
          score: 0,
          matchedTerms: [],
        });
      }
      return references;
    },
  };
}

export function parseMoodLexicon(value: unknown): MoodLexicon {
  const parsed = MoodLexiconSchema.parse(value);
  return {
    version: parsed.version,
    categories: parsed.categories,
    singleCharacterTokens: parsed.single_character_tokens,
    stopTerms: parsed.stop_terms,
  };
}

const cachedLexicons = new Map<string, Promise<MoodLexicon>>();

export function loadMoodLexicon(
  lexiconPath = path.resolve(process.env.ARIOSO_POEM_LEXICON ?? path.join("corpus", "poem", "mood-lexicon.json")),
): Promise<MoodLexicon> {
  const cached = cachedLexicons.get(lexiconPath);
  if (cached) return cached;
  const loaded = readFile(lexiconPath, "utf8")
    .then((text) => parseMoodLexicon(JSON.parse(text)))
    .catch((error: unknown) => {
      cachedLexicons.delete(lexiconPath);
      throw error;
    });
  cachedLexicons.set(lexiconPath, loaded);
  return loaded;
}

export function parsePoemRecords(text: string): {
  records: NormalizedPoemRecord[];
  rejected: number;
} {
  const records: NormalizedPoemRecord[] = [];
  let rejected = 0;
  for (const line of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      rejected += 1;
      continue;
    }
    const parsed = PoemRecordSchema.safeParse(value);
    // One malformed record must not take the whole corpus down.
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    records.push(parsed.data as NormalizedPoemRecord);
  }
  return { records, rejected };
}

export type PoemLanguage = "zh" | "en";

/** Pick the corpus language from what the user actually wrote. */
export function detectPoemLanguage(userMessages: string[]): PoemLanguage {
  const text = userMessages.join(" ");
  let cjk = 0;
  let latin = 0;
  for (const character of text) {
    if (/[\u3400-\u9fff]/u.test(character)) cjk += 1;
    else if (/[a-z]/iu.test(character)) latin += 1;
  }
  return cjk >= latin ? "zh" : "en";
}

const POEM_CORPUS_DEFAULTS: Record<PoemLanguage, { corpus: string; manifest: string }> = {
  zh: {
    corpus: path.join("corpus", "poem", "Chinese", "modern_poems.normalized.jsonl"),
    manifest: "modern_poems.manifest.json",
  },
  en: {
    corpus: path.join("corpus", "poem", "English", "english_poems.normalized.jsonl"),
    manifest: "english_poems.manifest.json",
  },
};

export interface LoadPoemRetrieverOptions {
  corpusPath?: string | undefined;
  manifestPath?: string | undefined;
  lexiconPath?: string | undefined;
  lexicon?: MoodLexicon | undefined;
  /** Default corpus language when no explicit path is supplied. */
  language?: PoemLanguage | undefined;
}

export interface LoadedPoemRetriever {
  retriever: PoemRetriever;
  corpusVersion: string;
  rejectedRecords: number;
}

/**
 * Load and validate the corpus. A missing corpus, a checksum mismatch or an
 * empty valid set throws: the caller turns that into an advisory trace and
 * still generates the proposal.
 */
export async function loadPoemRetriever(
  options: LoadPoemRetrieverOptions = {},
): Promise<LoadedPoemRetriever> {
  const defaults = POEM_CORPUS_DEFAULTS[options.language ?? "zh"];
  const corpusPath = path.resolve(
    options.corpusPath
      ?? process.env.ARIOSO_POEM_CORPUS
      ?? defaults.corpus,
  );
  const manifestPath = path.resolve(
    options.manifestPath ?? path.join(path.dirname(corpusPath), defaults.manifest),
  );
  const lexicon = options.lexicon ?? await loadMoodLexicon(options.lexiconPath);

  const [text, manifestText] = await Promise.all([
    readFile(corpusPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  const manifest: unknown = JSON.parse(manifestText);
  const expected = typeof manifest === "object" && manifest !== null
    && "checksum" in manifest && typeof manifest.checksum === "object" && manifest.checksum !== null
    && "value" in manifest.checksum && typeof manifest.checksum.value === "string"
    ? manifest.checksum.value
    : undefined;
  if (!expected) throw new Error(`The poem manifest at ${manifestPath} has no checksum.`);
  const actual = sha256(text);
  if (actual !== expected) {
    throw new Error(`The poem corpus checksum does not match its manifest (${corpusPath}).`);
  }

  const { records, rejected } = parsePoemRecords(text);
  if (!records.length) throw new Error(`The poem corpus contains no valid records (${corpusPath}).`);
  return {
    retriever: createPoemRetriever(records, { corpusVersion: actual, lexicon }),
    corpusVersion: actual,
    rejectedRecords: rejected,
  };
}
