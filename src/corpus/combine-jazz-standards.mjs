import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function titleKey(title) {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function combineRecords(wikipedia, book) {
  const records = [...wikipedia, ...book];
  if (new Set(records.map((record) => record.id)).size !== records.length) {
    throw new Error("Source document IDs must be unique across the combined corpus.");
  }
  const wikiTitles = new Set(wikipedia.map((record) => titleKey(record.title)));
  const searchable = records.filter((record) => record.normalization_status === "complete" && record.musical_description.trim());
  return {
    records,
    counts: {
      record_count: records.length,
      complete_count: searchable.length,
      insufficient_evidence_count: records.length - searchable.length,
      source_counts: { wikipedia: wikipedia.length, gioia_2012: book.length },
      searchable_source_counts: {
        wikipedia: searchable.filter((record) => !record.id.startsWith("gioia-2012-")).length,
        gioia_2012: searchable.filter((record) => record.id.startsWith("gioia-2012-")).length,
      },
      same_title_as_wikipedia_count: book.filter((record) => wikiTitles.has(titleKey(record.title))).length,
      book_only_title_count: book.filter((record) => !wikiTitles.has(titleKey(record.title))).length,
      distinct_title_count: new Set(records.map((record) => titleKey(record.title))).size,
      distinct_title_count_method: "Case/punctuation/diacritic-insensitive title strings; aliases are not resolved. This is not a verified unique-composition count.",
    },
  };
}

const parseJsonLines = (text) => text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));

export async function combineJazzCorpus(corpusDir = path.resolve("corpus", "jazz")) {
  const files = ["jazz_standards.normalized.jsonl", "gioia_2012.normalized.jsonl"];
  const inputs = await Promise.all(files.map(async (file) => parseJsonLines(await readFile(path.join(corpusDir, file), "utf8"))));
  const { records, counts } = combineRecords(inputs[0], inputs[1]);
  const output = "jazz_standards.combined.normalized.jsonl";
  await writeFile(path.join(corpusDir, output), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  const manifest = {
    corpus_id: "arioso-jazz-standards-combined",
    schema_version: "0.3.0",
    generated_at: new Date().toISOString(),
    input_files: files,
    output_file: output,
    record_unit: "One source document discussing one tune; the same tune in different sources counts separately.",
    ...counts,
    assignment_minimum: 500,
    exceeds_assignment_minimum: counts.record_count > 500,
    searchable_records_exceed_minimum: counts.complete_count > 500,
    book_source_license: "All rights reserved. Book-derived source text is local research material, not CC-BY-SA Wikipedia text.",
  };
  await writeFile(path.join(corpusDir, "jazz_standards.combined.normalized.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Combined ${counts.record_count} source records (${counts.complete_count} searchable); ${counts.distinct_title_count} normalized title strings.`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  combineJazzCorpus().catch((error) => { console.error(error); process.exitCode = 1; });
}
