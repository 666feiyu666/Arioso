import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectMusicalEvidence, musicalDescription, musicalFeatures } from "./jazz-evidence.mjs";

const corpusDir = path.resolve("corpus", "jazz");
const inputFile = path.join(corpusDir, "jazz_genres.raw.jsonl");
const outputFile = path.join(corpusDir, "jazz_genres.normalized.jsonl");
const manifestFile = path.join(corpusDir, "jazz_genres.normalized.manifest.json");
const articleFile = path.join(corpusDir, "jazz_genres.article_evidence.jsonl");

async function main() {
  const raw = (await readFile(inputFile, "utf8")).split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse);
  let articles = [];
  try { articles = (await readFile(articleFile, "utf8")).split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const byId = new Map(articles.map((article) => [article.id, article]));
  const records = raw.map((record) => {
    const source = record.source_evidence;
    const revisionUrl = `${source.seed_page_url}?oldid=${source.seed_revision_id}`;
    const article = byId.get(record.id);
    const evidence = collectMusicalEvidence({
      title: record.name, article_url: source.article_url, article_extract: source.article_intro,
      article_revision_id: source.article_revision_id,
      seed_evidence: [{ list_description: source.characteristics, seed_page_revision_url: revisionUrl }],
    }, article).map((item) => item.source === "seed_description" ? { ...item, source: "seed_characteristics" } : item);
    return {
      id: record.id, record_type: "jazz_style", title: record.name, year: null, period: record.era || null,
      musical_description: musicalDescription(evidence, record.name),
      musical_evidence: evidence,
      evidence_type: "source_excerpt",
      musical_features: [...new Set(evidence.flatMap((item) => musicalFeatures(item.text, record.name)))],
      normalization_status: evidence.length ? "complete" : "insufficient_musical_evidence",
      source: { article_url: source.article_url, article_revision_url: article?.enrichment_status === "complete" ? article.source.revision_url : null, seed_revision_urls: [revisionUrl], license: source.license, attribution: "English Wikipedia contributors; see the pinned revision histories." },
    };
  });
  await writeFile(outputFile, `${records.map(JSON.stringify).join("\n")}\n`, "utf8");
  const incomplete = records.filter((record) => record.normalization_status !== "complete");
  const manifest = {
    corpus_id: "arioso-jazz-genres-normalized", schema_version: "0.1.0", generated_at: new Date().toISOString(),
    source_file: path.basename(inputFile), output_file: path.basename(outputFile), record_count: records.length,
    complete_count: records.length - incomplete.length, insufficient_evidence_count: incomplete.length,
    article_evidence_file: articles.length ? path.basename(articleFile) : null,
    article_body_count: articles.filter((article) => article.enrichment_status === "complete").length,
    incomplete_records: incomplete.map((record) => ({ id: record.id, title: record.title, reason: "No specific musical evidence found in available source prose." })),
    normalization_method: "Source-excerpt sentence filtering over pinned jazz-genre table characteristics and revision-pinned article prose. Agent-facing descriptions prioritize musical analysis and feature diversity with a 300-word/12-sentence budget (a single longer source sentence is preserved intact); full evidence and raw snapshots are retained separately.",
  };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${records.length} styles (${manifest.complete_count} with musical evidence)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
