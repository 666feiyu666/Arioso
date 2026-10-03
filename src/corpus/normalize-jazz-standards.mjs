import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectMusicalEvidence, musicalDescription, musicalFeatures } from "./jazz-evidence.mjs";

const CORPUS_DIR = path.resolve("corpus", "jazz");
const INPUT_FILE = path.join(CORPUS_DIR, "jazz_standards.raw.jsonl");
const OUTPUT_FILE = path.join(CORPUS_DIR, "jazz_standards.normalized.jsonl");
const MANIFEST_FILE = path.join(CORPUS_DIR, "jazz_standards.normalized.manifest.json");
const ARTICLE_FILE = path.join(CORPUS_DIR, "jazz_standards.article_evidence.jsonl");

function parseJsonLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function normalizeRecord(record, article) {
  const musicalEvidence = collectMusicalEvidence(record, article);
  const description = musicalDescription(musicalEvidence, record.title);
  const features = [...new Set(musicalEvidence.flatMap((item) => musicalFeatures(item.text, record.title)))];
  const seedRevisionUrls = [
    ...new Set(
      (record.seed_evidence ?? [])
        .map((item) => item.seed_page_revision_url)
        .filter(Boolean),
    ),
  ];

  return {
    id: record.id,
    record_type: record.record_type,
    title: record.title,
    year: record.year ?? null,
    period: record.period ?? null,
    musical_description: description,
    musical_evidence: musicalEvidence,
    evidence_type: "source_excerpt",
    musical_features: features,
    normalization_status: description ? "complete" : "insufficient_musical_evidence",
    source: {
      article_url: record.article_url ?? null,
      article_revision_id: record.article_revision_id ?? null,
      article_revision_url: record.article_revision_id ? `${record.article_url}?oldid=${record.article_revision_id}` : null,
      seed_revision_urls: seedRevisionUrls,
      license: record.source_license,
      attribution: "English Wikipedia contributors; see the pinned revision histories.",
    },
  };
}

async function main() {
  const rawRecords = parseJsonLines(await readFile(INPUT_FILE, "utf8"));
  let articles = [];
  try { articles = parseJsonLines(await readFile(ARTICLE_FILE, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const byId = new Map(articles.map((article) => [article.id, article]));
  const normalizedRecords = rawRecords.map((record) => {
    const article = byId.get(record.id);
    return normalizeRecord(record, article?.source?.revision_id === record.article_revision_id ? article : undefined);
  });
  const completeCount = normalizedRecords.filter(
    (record) => record.normalization_status === "complete",
  ).length;

  await mkdir(CORPUS_DIR, { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    `${normalizedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  await writeFile(
    MANIFEST_FILE,
    `${JSON.stringify(
      {
        corpus_id: "arioso-jazz-standards-normalized",
        schema_version: "0.2.0",
        generated_at: new Date().toISOString(),
        source_file: path.basename(INPUT_FILE),
        output_file: path.basename(OUTPUT_FILE),
        record_count: normalizedRecords.length,
        complete_count: completeCount,
        insufficient_evidence_count: normalizedRecords.length - completeCount,
        article_evidence_file: articles.length ? path.basename(ARTICLE_FILE) : null,
        article_body_count: articles.filter((article) => article.enrichment_status === "complete").length,
        feature_coverage: Object.fromEntries(["harmony", "rhythm", "melody", "form", "instrumentation", "arrangement", "style", "mood"].map((feature) =>
          [feature, normalizedRecords.filter((record) => record.musical_features.includes(feature)).length])),
        limited_evidence_count: normalizedRecords.filter((record) => record.normalization_status === "complete" && record.musical_features.length < 2).length,
        incomplete_records: normalizedRecords.filter((record) => record.normalization_status !== "complete").map((record) => ({
          id: record.id, title: record.title, article_url: record.source.article_url,
          reason: "No specific musical evidence found in available source prose.",
        })),
        normalization_method:
          "Source-excerpt sentence filtering over seed descriptions, intro snapshots and pinned article-body paragraphs. Generic standard status and title-only fragments are excluded. Agent-facing descriptions prioritize musical analysis and feature diversity, with a 300-word/12-sentence budget (a single longer source sentence is preserved intact). Full filtered evidence is retained. Complete means evidence is present, not that every musical dimension is documented.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Wrote ${normalizedRecords.length} normalized works (${completeCount} with musical evidence) to ${OUTPUT_FILE}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
