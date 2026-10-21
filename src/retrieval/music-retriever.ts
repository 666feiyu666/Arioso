import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

// One bounded retrieval layer for every supported music type. Jazz is the first
// populated type; the others share the same style-plus-standard structure.
// Each type keeps two independent TF-IDF indexes so a large standards
// collection cannot crowd out the small style collection.

export const MUSIC_TYPES = [
  "jazz",
  "blues",
  "electronic",
  "instrumental-rock",
  "instrumental-hip-hop",
] as const;

export type MusicType = (typeof MUSIC_TYPES)[number];

export const MUSIC_REFERENCE_KINDS = ["style", "standard"] as const;
export type MusicReferenceKind = (typeof MUSIC_REFERENCE_KINDS)[number];

export type MusicSearchMode = "auto" | "title" | "description";
export type MusicSelectionSource = "user" | "interface" | "composer";

export interface NormalizedMusicRecord {
  id: string;
  record_type?: string;
  title: string;
  year: number | null;
  period: string | null;
  musical_description: string;
  musical_features?: string[];
  normalization_status: "complete" | "insufficient_musical_evidence";
  source: {
    article_url: string | null;
    license?: { name?: string } & Record<string, unknown>;
  } & Record<string, unknown>;
}

export interface RetrievedMusicReference {
  id: string;
  musicType: MusicType;
  kind: MusicReferenceKind;
  title: string;
  score: number;
  year: number | null;
  period: string | null;
  musicalDescription: string;
  articleUrl: string | null;
  source: NormalizedMusicRecord["source"];
  matchType: "title" | "description";
  normalizationStatus: NormalizedMusicRecord["normalization_status"];
}

export interface MusicRetrievalTrace {
  musicType: MusicType;
  selectionSource: MusicSelectionSource;
  query: string;
  mode: "title" | "description";
  styleReferenceIds: string[];
  standardReferenceIds: string[];
}

export interface MusicSearchInput {
  musicType: MusicType;
  mode?: MusicSearchMode | undefined;
  query: string;
  /** Total references requested; 5 is the maximum and splits into 2 styles + 3 standards. */
  limit?: number | undefined;
}

export interface MusicRetrievalResult {
  musicType: MusicType;
  mode: "title" | "description";
  references: RetrievedMusicReference[];
  /** Set when the collection is missing, malformed, or produced no usable match. */
  unavailableReason?: string | undefined;
}

export interface MusicRetriever {
  search(input: MusicSearchInput): MusicRetrievalResult;
  availableTypes(): MusicType[];
  /**
   * Resolve reference IDs recorded by the Composer back into readable titles.
   * Unknown IDs are dropped so a stale trace cannot break a response.
   */
  findByIds(ids: string[]): MusicReferenceSummary[];
}

/** The part of a stored reference that is safe to show in the interface. */
export interface MusicReferenceSummary {
  id: string;
  kind: MusicReferenceKind;
  musicType: MusicType;
  title: string;
  period: string | null;
}

export interface MusicTypeCollections {
  styles: NormalizedMusicRecord[];
  standards: NormalizedMusicRecord[];
  unavailableReason?: string | undefined;
}

export type MusicCollections = Partial<Record<MusicType, MusicTypeCollections>>;

const MAX_LIMIT = 5;
const MAX_STYLES = 2;
const MAX_STANDARDS = 3;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
  "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
  "this", "to", "was", "were", "with",
  "back", "jazz", "laid", "music", "piece", "song", "standard", "tune",
]);

function tokenize(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)
    ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

/** Title comparison ignores case, punctuation, whitespace, and diacritics. */
export function normalizeMusicTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function magnitude(weights: Map<string, number>): number {
  return Math.sqrt([...weights.values()].reduce((sum, weight) => sum + weight ** 2, 0));
}

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

interface IndexedDocument {
  record: NormalizedMusicRecord;
  weights: Map<string, number>;
  magnitude: number;
}

interface CollectionIndex {
  documents: IndexedDocument[];
  inverseDocumentFrequency: Map<string, number>;
  titleIndex: Map<string, NormalizedMusicRecord[]>;
}

function recordTokens(record: NormalizedMusicRecord): string[] {
  // The title carries a modest weight: repeating it once is enough to break
  // ties toward the work the user named without dominating the description.
  return [
    ...tokenize(record.title),
    ...tokenize(record.title),
    ...tokenize(record.period ?? ""),
    ...tokenize(record.musical_description),
    ...tokenize((record.musical_features ?? []).join(" ")),
  ];
}

function buildIndex(records: NormalizedMusicRecord[]): CollectionIndex {
  const searchable = records.filter(
    (record) => record.normalization_status === "complete" && record.musical_description.trim(),
  );
  const documentTokens = searchable.map(recordTokens);
  const documentFrequency = new Map<string, number>();
  for (const tokens of documentTokens) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([term, frequency]) => [
      term,
      Math.log((searchable.length + 1) / (frequency + 1)) + 1,
    ]),
  );
  const documents = searchable.map((record, index) => {
    const weights = weightsFor(termCounts(documentTokens[index] ?? []), inverseDocumentFrequency);
    return { record, weights, magnitude: magnitude(weights) };
  });
  const titleIndex = new Map<string, NormalizedMusicRecord[]>();
  for (const record of records) {
    const key = normalizeMusicTitle(record.title);
    if (!key) continue;
    const matches = titleIndex.get(key) ?? [];
    matches.push(record);
    titleIndex.set(key, matches);
  }
  return { documents, inverseDocumentFrequency, titleIndex };
}

function referenceFor(
  record: NormalizedMusicRecord,
  musicType: MusicType,
  kind: MusicReferenceKind,
  score: number,
  matchType: RetrievedMusicReference["matchType"],
): RetrievedMusicReference {
  return {
    id: record.id,
    musicType,
    kind,
    title: record.title,
    score: Number(score.toFixed(6)),
    year: record.year,
    period: record.period,
    musicalDescription: record.musical_description,
    articleUrl: record.source.article_url,
    source: record.source,
    matchType,
    normalizationStatus: record.normalization_status,
  };
}

function searchByDescription(
  index: CollectionIndex,
  query: string,
  limit: number,
): { record: NormalizedMusicRecord; score: number }[] {
  const queryWeights = weightsFor(termCounts(tokenize(query)), index.inverseDocumentFrequency);
  const queryMagnitude = magnitude(queryWeights);
  if (!queryWeights.size || queryMagnitude === 0) return [];
  return index.documents
    .map((document) => {
      let dotProduct = 0;
      for (const [term, queryWeight] of queryWeights) {
        dotProduct += queryWeight * (document.weights.get(term) ?? 0);
      }
      return {
        record: document.record,
        // Zero-score records are never offered as references.
        score: document.magnitude === 0
          ? 0
          : dotProduct / (queryMagnitude * document.magnitude),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
    .slice(0, limit);
}

export function createMusicRetriever(collections: MusicCollections): MusicRetriever {
  const indexes = new Map<MusicType, { styles: CollectionIndex; standards: CollectionIndex }>();
  for (const musicType of MUSIC_TYPES) {
    const collection = collections[musicType];
    if (!collection) continue;
    indexes.set(musicType, {
      styles: buildIndex(collection.styles),
      standards: buildIndex(collection.standards),
    });
  }

  const availableTypes = (): MusicType[] => MUSIC_TYPES.filter((musicType) => {
    const collection = collections[musicType];
    // A type only becomes selectable once it has both validated collections.
    return Boolean(
      collection
      && !collection.unavailableReason
      && collection.styles.length
      && collection.standards.length,
    );
  });

  const recordsById = new Map<
    string,
    { record: NormalizedMusicRecord; musicType: MusicType; kind: MusicReferenceKind }
  >();
  for (const musicType of MUSIC_TYPES) {
    const collection = collections[musicType];
    if (!collection) continue;
    for (const record of collection.styles) recordsById.set(record.id, { record, musicType, kind: "style" });
    for (const record of collection.standards) recordsById.set(record.id, { record, musicType, kind: "standard" });
  }

  return {
    availableTypes,
    findByIds(ids: string[]): MusicReferenceSummary[] {
      const summaries: MusicReferenceSummary[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const entry = recordsById.get(id);
        if (!entry) continue;
        summaries.push({
          id: entry.record.id,
          kind: entry.kind,
          musicType: entry.musicType,
          title: entry.record.title,
          period: entry.record.period,
        });
      }
      return summaries;
    },
    search(input: MusicSearchInput): MusicRetrievalResult {
      const { musicType } = input;
      const collection = collections[musicType];
      const index = indexes.get(musicType);
      const requestedMode: "title" | "description" = input.mode === "title" ? "title" : "description";
      if (!collection || !index) {
        return {
          musicType,
          mode: requestedMode,
          references: [],
          unavailableReason: collection?.unavailableReason
            ?? `No ${musicType} corpus is configured.`,
        };
      }
      const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? MAX_LIMIT), MAX_LIMIT));

      // "auto" means: a named work goes through exact title search, anything
      // else is compared by musical description.
      const useTitle = input.mode === "title"
        || (input.mode !== "description" && index.standards.titleIndex.has(normalizeMusicTitle(input.query)));

      if (useTitle) {
        const matches = index.standards.titleIndex.get(normalizeMusicTitle(input.query)) ?? [];
        const references = matches
          .slice()
          .sort((left, right) => left.id.localeCompare(right.id))
          .slice(0, limit)
          .map((record) => referenceFor(record, musicType, "standard", 1, "title"));
        return {
          musicType,
          mode: "title",
          references,
          ...(references.length ? {} : {
            unavailableReason: `No ${musicType} standard matches the supplied title.`,
          }),
        };
      }

      const styleLimit = Math.min(MAX_STYLES, limit);
      const standardLimit = Math.min(MAX_STANDARDS, Math.max(0, limit - styleLimit));
      const styles = searchByDescription(index.styles, input.query, styleLimit)
        .map(({ record, score }) => referenceFor(record, musicType, "style", score, "description"));
      const standards = searchByDescription(index.standards, input.query, standardLimit)
        .map(({ record, score }) => referenceFor(record, musicType, "standard", score, "description"));
      const references = [...styles, ...standards];
      return {
        musicType,
        mode: "description",
        references,
        ...(references.length ? {} : {
          unavailableReason: `No ${musicType} description match was found.`,
        }),
      };
    },
  };
}

const MusicRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  period: z.string().nullable(),
  musical_description: z.string(),
  musical_features: z.array(z.string()).optional(),
  normalization_status: z.enum(["complete", "insufficient_musical_evidence"]),
  source: z.object({ article_url: z.string().nullable() }).passthrough(),
}).passthrough();

function parseJsonLines(text: string, sourcePath: string): NormalizedMusicRecord[] {
  const records: NormalizedMusicRecord[] = [];
  for (const [index, line] of text.replace(/^\uFEFF/u, "").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON in music corpus ${sourcePath} at line ${index + 1}.`, { cause: error });
    }
    const parsed = MusicRecordSchema.safeParse(value);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid music corpus record in ${sourcePath} at line ${index + 1}: ${issues}`);
    }
    records.push(parsed.data as NormalizedMusicRecord);
  }
  return records;
}

/**
 * File candidates in reading order. The second name is the pre-migration Jazz
 * artifact, kept so an existing local corpus keeps working.
 */
const COLLECTION_FILES: Record<MusicType, { styles: string[]; standards: string[] }> = {
  jazz: {
    styles: ["styles.normalized.jsonl", "jazz_genres.normalized.jsonl"],
    standards: ["standards.normalized.jsonl", "jazz_standards.combined.normalized.jsonl"],
  },
  blues: { styles: ["styles.normalized.jsonl"], standards: ["standards.normalized.jsonl"] },
  electronic: { styles: ["styles.normalized.jsonl"], standards: ["standards.normalized.jsonl"] },
  "instrumental-rock": { styles: ["styles.normalized.jsonl"], standards: ["standards.normalized.jsonl"] },
  "instrumental-hip-hop": { styles: ["styles.normalized.jsonl"], standards: ["standards.normalized.jsonl"] },
};

async function readFirstAvailable(
  directory: string,
  candidates: string[],
): Promise<{ records: NormalizedMusicRecord[]; file: string } | undefined> {
  for (const file of candidates) {
    const target = path.join(directory, file);
    try {
      await stat(target);
    } catch {
      continue;
    }
    return { records: parseJsonLines(await readFile(target, "utf8"), target), file };
  }
  return undefined;
}

export interface MusicCorpusAvailability {
  /** Both normalized collections exist and parse. */
  available: boolean;
  styles: boolean;
  standards: boolean;
  reason?: string | undefined;
}

export interface LoadMusicRetrieverOptions {
  /** Canonical corpus root, defaulting to corpus/music (or ARIOSO_MUSIC_CORPUS_ROOT). */
  root?: string | undefined;
  /** Temporary fallback for a Jazz-only corpus directory (ARIOSO_JAZZ_CORPUS). */
  jazzFallback?: string | undefined;
}

export async function loadMusicCorpus(
  options: LoadMusicRetrieverOptions = {},
): Promise<{ retriever: MusicRetriever; availability: Record<MusicType, MusicCorpusAvailability> }> {
  const root = path.resolve(
    options.root ?? process.env.ARIOSO_MUSIC_CORPUS_ROOT ?? path.join("corpus", "music"),
  );
  const jazzFallback = options.jazzFallback ?? process.env.ARIOSO_JAZZ_CORPUS;

  const collections: MusicCollections = {};
  const availability = {} as Record<MusicType, MusicCorpusAvailability>;

  for (const musicType of MUSIC_TYPES) {
    const directory = musicType === "jazz" && jazzFallback
      ? path.dirname(path.resolve(jazzFallback))
      : path.join(root, musicType);
    try {
      const styles = await readFirstAvailable(directory, COLLECTION_FILES[musicType].styles);
      const standards = await readFirstAvailable(directory, COLLECTION_FILES[musicType].standards);
      if (!styles && !standards) {
        availability[musicType] = {
          available: false,
          styles: false,
          standards: false,
          reason: `No normalized ${musicType} corpus was found in ${directory}.`,
        };
        continue;
      }
      collections[musicType] = {
        styles: styles?.records ?? [],
        standards: standards?.records ?? [],
      };
      availability[musicType] = {
        available: Boolean(styles && standards),
        styles: Boolean(styles),
        standards: Boolean(standards),
        ...(styles && standards ? {} : { reason: `The ${musicType} corpus is incomplete.` }),
      };
    } catch (error) {
      // A malformed collection must become an explicit unavailable result, not
      // a crash at startup.
      const reason = error instanceof Error ? error.message : String(error);
      availability[musicType] = {
        available: false,
        styles: false,
        standards: false,
        reason,
      };
      collections[musicType] = { styles: [], standards: [], unavailableReason: reason };
    }
  }

  return { retriever: createMusicRetriever(collections), availability };
}

let cached: Promise<Awaited<ReturnType<typeof loadMusicCorpus>>> | undefined;

export function loadMusicRetriever(
  options: LoadMusicRetrieverOptions = {},
): Promise<Awaited<ReturnType<typeof loadMusicCorpus>>> {
  if (options.root || options.jazzFallback) return loadMusicCorpus(options);
  cached ??= loadMusicCorpus().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
