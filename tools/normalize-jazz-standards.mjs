import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CORPUS_DIR = path.resolve("corpus", "jazz");
const INPUT_FILE = path.join(CORPUS_DIR, "jazz_standards.raw.jsonl");
const OUTPUT_FILE = path.join(CORPUS_DIR, "jazz_standards.normalized.jsonl");
const MANIFEST_FILE = path.join(CORPUS_DIR, "jazz_standards.normalized.manifest.json");

const MUSICAL_TERMS = [
  /\b(?:jazz|blues|ragtime|swing|bebop|bop|dixieland|stride|boogie(?:-woogie)?|gospel|spiritual|ballad|bossa nova|samba|calypso|funk|modal|fusion)\b/i,
  /\b(?:melod(?:y|ic)|harmon(?:y|ic)|chords?|progression|tonal(?:ity)?|atonal|key|major|minor|mode|scale|motif|riff|theme)\b/i,
  /\b(?:rhythm|groove|swing|syncopat(?:e|ed|ion)|tempo|bpm|meter|time signature|\d+\/\d+|bars?|chorus|verse|bridge|refrain|form)\b/i,
  /\b(?:instrumental|vocals?|singer|ensemble|orchestra|band|trio|quartet|quintet|solo|improvis(?:e|ed|ation)|arrang(?:e|ed|ement))\b/i,
  /\b(?:piano|organ|guitar|bass|drums?|percussion|saxophone|sax|trumpet|trombone|clarinet|violin|vibraphone|flute|horns?)\b/i,
  /\b(?:performed|played|phrasing|timbre|texture|register|counterpoint|call and response|walking bass|brushes)\b/i,
];

const NON_MUSICAL_HISTORY_PATTERNS = [
  /\b(?:copyrighted|copyright|published|publisher|written by|composed by|composition by|described by (?:its|the) composer|credited|pseudonym|music co\.)\b/i,
  /\b(?:recording|recorded|released|debuted|chart(?:ed|s)?|sales|sold|award|grammy|hit)\b/i,
  /\b(?:popular|popularized|popularity|famous|influential|requested|requests|price)\b/i,
  /\b(?:born|died|death|manager)\b/i,
  /\b(?:film|movie|television|broadway|radio program)\b/i,
];

function parseJsonLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function splitSentences(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(?:[A-Z]\.\s*){2,}(?=[A-Z][a-z])/g, (initials) =>
      initials.replaceAll(".", "<period>"),
    )
    .replace(/\b(St|Mr|Mrs|Ms|Dr|Jr|Sr)\./g, "$1<period>")
    .split(/(?<=[.!?])\s+(?=["“']?[A-Z0-9])/)
    .map((sentence) => sentence.replaceAll("<period>", ".").trim())
    .filter(Boolean);
}

function musicalScore(sentence) {
  return MUSICAL_TERMS.reduce(
    (score, pattern) => score + (pattern.test(sentence) ? 1 : 0),
    0,
  );
}

function isMusicalEvidence(sentence) {
  return (
    musicalScore(sentence) > 0 &&
    !NON_MUSICAL_HISTORY_PATTERNS.some((pattern) => pattern.test(sentence))
  );
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueEvidence(evidence) {
  const seen = new Set();
  return evidence.filter((item) => {
    item.text = normalizeWhitespace(item.text);
    const key = item.text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceFor(record) {
  const evidence = [];
  for (const item of record.seed_evidence ?? []) {
    for (const sentence of splitSentences(item.list_description)) {
      if (isMusicalEvidence(sentence)) {
        evidence.push({ source: "seed_description", text: sentence });
      }
    }
  }
  for (const sentence of splitSentences(record.article_extract)) {
    if (isMusicalEvidence(sentence)) {
      evidence.push({ source: "article_extract", text: sentence });
    }
  }
  return uniqueEvidence(evidence);
}

function normalizeRecord(record) {
  const musicalEvidence = evidenceFor(record);
  const musicalDescription = musicalEvidence.map((item) => item.text).join(" ");
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
    musical_description: musicalDescription,
    musical_evidence: musicalEvidence,
    normalization_status: musicalDescription ? "complete" : "insufficient_musical_evidence",
    source: {
      article_url: record.article_url ?? null,
      article_revision_id: record.article_revision_id ?? null,
      seed_revision_urls: seedRevisionUrls,
    },
  };
}

async function main() {
  const rawRecords = parseJsonLines(await readFile(INPUT_FILE, "utf8"));
  const normalizedRecords = rawRecords.map(normalizeRecord);
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
        schema_version: "0.1.0",
        generated_at: new Date().toISOString(),
        source_file: path.basename(INPUT_FILE),
        output_file: path.basename(OUTPUT_FILE),
        record_count: normalizedRecords.length,
        complete_count: completeCount,
        insufficient_evidence_count: normalizedRecords.length - completeCount,
        normalization_method:
          "Evidence-preserving sentence filtering over seed descriptions and article extracts using explicit musical-language patterns.",
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
