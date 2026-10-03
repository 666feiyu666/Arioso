import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMusicalEvidence, musicalDescription, musicalFeatures, splitSentences } from "./jazz-evidence.mjs";
import { titleKey } from "./combine-jazz-standards.mjs";

export function normalizeBookRecord(record, wikipediaByTitle = new Map()) {
  const slug = record.title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const spans = [];
  let prose = "";
  for (const paragraph of record.paragraphs) {
    if (prose) prose += " ";
    const start = prose.length;
    prose += paragraph.text;
    spans.push({ start, end: prose.length, paragraph });
  }
  let cursor = 0;
  const seen = new Set();
  const evidence = [];
  for (const sentence of splitSentences(prose)) {
    const start = prose.indexOf(sentence, cursor);
    if (start < 0) throw new Error(`Cannot map sentence back to PDF pages: ${record.title}`);
    cursor = start + sentence.length;
    if (!isMusicalEvidence(sentence, record.title) || seen.has(sentence)) continue;
    seen.add(sentence);
    const covered = spans.filter((span) => span.start < cursor && span.end > start);
    evidence.push({
      source: "book_chapter",
      section: "Tune discussion",
      text: sentence,
      pdf_page_start: covered[0].paragraph.pdf_page,
      pdf_page_end: covered.at(-1).paragraph.pdf_page,
      printed_page_start: covered[0].paragraph.printed_page,
      printed_page_end: covered.at(-1).paragraph.printed_page,
    });
  }
  const description = musicalDescription(evidence, record.title);
  const match = wikipediaByTitle.get(titleKey(record.title));
  return {
    id: `gioia-2012-${slug}`,
    work_id: match?.id ?? null,
    record_type: "jazz_standard",
    title: record.title,
    year: null,
    period: null,
    musical_description: description,
    musical_evidence: evidence,
    evidence_type: "source_excerpt",
    musical_features: [...new Set(evidence.flatMap((item) => musicalFeatures(item.text, record.title)))],
    normalization_status: description ? "complete" : "insufficient_musical_evidence",
    source: record.source,
  };
}

export async function normalizeBookCorpus(corpusDir = path.resolve("corpus", "jazz")) {
  const parse = (text) => text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const [raw, wikipedia] = await Promise.all([
    readFile(path.join(corpusDir, "gioia_2012.raw.jsonl"), "utf8").then(parse),
    readFile(path.join(corpusDir, "jazz_standards.normalized.jsonl"), "utf8").then(parse),
  ]);
  const byTitle = new Map(wikipedia.map((record) => [titleKey(record.title), record]));
  const records = raw.map((record) => normalizeBookRecord(record, byTitle));
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate book chapter IDs.");
  const complete = records.filter((record) => record.normalization_status === "complete").length;
  await writeFile(path.join(corpusDir, "gioia_2012.normalized.jsonl"), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  const manifest = {
    corpus_id: "arioso-gioia-2012-jazz-standards",
    schema_version: "0.3.0",
    generated_at: new Date().toISOString(),
    source_file: "gioia_2012.raw.jsonl",
    output_file: "gioia_2012.normalized.jsonl",
    record_unit: "One complete tune discussion from the 2012 first edition; recommended-recording lists are preserved separately in raw records.",
    record_count: records.length,
    complete_count: complete,
    insufficient_evidence_count: records.length - complete,
    pdf_sha256: raw[0]?.source.pdf_sha256,
    zotero_item_key: raw[0]?.source.zotero_item_key,
    zotero_attachment_key: raw[0]?.source.zotero_attachment_key,
    extraction_method: "Each of the 252 PDF tune bookmarks is checked against actual chapter-title typography. Page headers, alphabet decorations and blank pages are removed. Artificial spaces contained inside adjacent printed glyphs are removed; typographic ligatures are expanded. Line-wrap hyphenation is normalized, retaining compound hyphens when the same hyphenated word appears unbroken elsewhere in the book. Source prose is not paraphrased or translated.",
    normalization_method: "The same musical-evidence sentence filter and 300-word/12-sentence selection budget as the Wikipedia corpus. Sentences may span pages and retain their page ranges. Composer credits and recommended-recording lists are excluded from retrieval evidence. Complete means evidence is present, not every musical dimension is documented.",
    license: raw[0]?.source.license,
    incomplete_records: records.filter((record) => record.normalization_status !== "complete").map((record) => ({ id: record.id, title: record.title })),
  };
  await writeFile(path.join(corpusDir, "gioia_2012.normalized.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Normalized ${records.length} Gioia chapters (${complete} with musical evidence).`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  normalizeBookCorpus().catch((error) => { console.error(error); process.exitCode = 1; });
}
