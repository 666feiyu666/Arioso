import { readFile } from "node:fs/promises";
import path from "node:path";

export interface NormalizedJazzRecord {
  id: string;
  title: string;
  year: number | null;
  period: string | null;
  musical_description: string;
  normalization_status: "complete" | "insufficient_musical_evidence";
  source: {
    article_url: string | null;
  };
}

export interface RetrievedJazzReference {
  id: string;
  title: string;
  score: number;
  year: number | null;
  period: string | null;
  musicalDescription: string;
  articleUrl: string | null;
}

interface IndexedDocument {
  record: NormalizedJazzRecord;
  weights: Map<string, number>;
  magnitude: number;
}

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

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
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
    if (idf !== undefined) {
      weights.set(term, (1 + Math.log(count)) * idf);
    }
  }
  return weights;
}

function parseJsonLines(text: string): NormalizedJazzRecord[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as NormalizedJazzRecord);
}

export interface JazzRetriever {
  search(query: string, limit?: number): RetrievedJazzReference[];
}

export function createJazzRetriever(records: NormalizedJazzRecord[]): JazzRetriever {
  const searchableRecords = records.filter(
    (record) =>
      record.normalization_status === "complete" && record.musical_description.trim(),
  );
  const documentTokens = searchableRecords.map((record) =>
    tokenize(record.musical_description),
  );
  const documentFrequency = new Map<string, number>();
  for (const tokens of documentTokens) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([term, frequency]) => [
      term,
      Math.log((searchableRecords.length + 1) / (frequency + 1)) + 1,
    ]),
  );
  const documents: IndexedDocument[] = searchableRecords.map((record, index) => {
    const weights = weightsFor(termCounts(documentTokens[index] ?? []), inverseDocumentFrequency);
    return { record, weights, magnitude: magnitude(weights) };
  });

  return {
    search(query: string, limit = 5): RetrievedJazzReference[] {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 5));
      const queryWeights = weightsFor(termCounts(tokenize(query)), inverseDocumentFrequency);
      const queryMagnitude = magnitude(queryWeights);

      return documents
        .map((document) => {
          let dotProduct = 0;
          for (const [term, queryWeight] of queryWeights) {
            dotProduct += queryWeight * (document.weights.get(term) ?? 0);
          }
          return {
            record: document.record,
            score:
              queryMagnitude === 0 || document.magnitude === 0
                ? 0
                : dotProduct / (queryMagnitude * document.magnitude),
          };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, safeLimit)
        .map(({ record, score }) => ({
          id: record.id,
          title: record.title,
          score: Number(score.toFixed(6)),
          year: record.year,
          period: record.period,
          musicalDescription: record.musical_description,
          articleUrl: record.source.article_url,
        }));
    },
  };
}

let cachedRetriever: Promise<JazzRetriever> | undefined;

export function loadJazzRetriever(): Promise<JazzRetriever> {
  const corpusPath = path.resolve(
    process.env.ARIOSO_JAZZ_CORPUS ??
      path.join("corpus", "jazz", "jazz_standards.normalized.jsonl"),
  );
  cachedRetriever ??= readFile(corpusPath, "utf8").then((text) =>
    createJazzRetriever(parseJsonLines(text)),
  );
  return cachedRetriever;
}
