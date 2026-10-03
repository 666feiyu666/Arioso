import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { articleParagraphs } from "./jazz-evidence.mjs";

const corpusDir = path.resolve("corpus", "jazz");
const genres = process.argv.includes("--genres");
const dataset = genres ? "jazz_genres" : "jazz_standards";
const extractorVersion = "0.2.0";
const inputFile = path.join(corpusDir, `${dataset}.raw.jsonl`);
const outputFile = path.join(corpusDir, `${dataset}.article_evidence.jsonl`);
const manifestFile = path.join(corpusDir, `${dataset}.article_evidence.manifest.json`);
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "AriosoJazzCorpus/0.1 (local academic corpus builder)";
const requestDelay = Math.max(1_000, Number(process.env.WIKIMEDIA_REQUEST_DELAY_MS ?? 1_500));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseLines = (text) => text.split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse);
let nextRequestAt = Date.now() + Number(process.env.WIKIMEDIA_INITIAL_DELAY_MS ?? 0);
let pacingMs = requestDelay;

async function wikiJson(route) {
  const url = new URL(`https://en.wikipedia.org/w/rest.php/v1/${route}`);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await pause(Math.max(0, nextRequestAt - Date.now()));
    nextRequestAt = Date.now() + pacingMs;
    try {
      const response = await fetch(url, { headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
      if (response.status === 429 || response.status >= 500) {
        const retryHeader = response.headers.get("retry-after");
        const retrySeconds = Number(retryHeader);
        const serverWait = retryHeader ? (Number.isFinite(retrySeconds) ? retrySeconds * 1_000 : Date.parse(retryHeader) - Date.now()) : 0;
        const wait = Math.max(Number.isFinite(serverWait) ? serverWait : 0, Math.min(60_000, 5_000 * 2 ** attempt));
        nextRequestAt = Date.now() + wait;
        if (response.status === 429) pacingMs = Math.min(10_000, Math.ceil(pacingMs * 1.5));
        console.warn(`Wikipedia API ${response.status}; respecting a ${Math.ceil(wait / 1_000)}s cooldown; request interval ${pacingMs}ms`);
        if (attempt === 5) throw new Error(`Wikipedia API ${response.status}`);
        continue;
      }
      if (!response.ok) throw new Error(`Wikipedia API ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(`${data.error.code}: ${data.error.info}`);
      return data;
    } catch (error) {
      if (attempt === 5 || /Wikipedia API 4|^[a-z_-]+:/i.test(error.message)) throw error;
      nextRequestAt = Math.max(nextRequestAt, Date.now() + Math.min(60_000, 2_000 * 2 ** attempt));
    }
  }
}

async function fetchArticle(record) {
  if (genres && !record.article_url) {
    return {
      id: record.id, title: record.title, enrichment_status: "seed_only", paragraphs: [],
      reason: "No standalone article link in the pinned genre table; its characteristics remain available as seed evidence.",
      source: { seed_revision_id: record.source_evidence.seed_revision_id, revision_url: `${record.source_evidence.seed_page_url}?oldid=${record.source_evidence.seed_revision_id}`, license: record.source_license },
    };
  }
  if (!genres && (!Number.isSafeInteger(record.article_revision_id) || record.article_revision_id <= 0)) {
    throw new Error("No pinned article revision is available.");
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const title = decodeURIComponent(new URL(record.article_url).pathname.slice(6)).replaceAll("_", " ");
      const route = record.article_revision_id ? `revision/${record.article_revision_id}/with_html` : `page/${encodeURIComponent(title)}/with_html`;
      const data = await wikiJson(route);
      const revisionId = record.article_revision_id ? data.id : data.latest?.id;
      if (!Number.isSafeInteger(revisionId) || revisionId <= 0) throw new Error("No article revision was returned.");
      if (record.article_revision_id && revisionId !== record.article_revision_id) throw new Error("Article revision mismatch.");
      const paragraphs = articleParagraphs(data.html);
      if (!paragraphs.length) throw new Error("No article prose was returned.");
      return {
        id: record.id,
        title: record.title,
        enrichment_status: "complete",
        paragraphs,
        source: {
          article_title: data.page?.title ?? data.title,
          article_url: record.article_url,
          revision_id: revisionId,
          revision_url: `${record.article_url}?oldid=${revisionId}`,
          api_url: `https://en.wikipedia.org/w/rest.php/v1/${route}`,
          extractor_version: extractorVersion,
          retrieved_at: new Date().toISOString(),
          license: data.license ?? record.source_license,
          attribution: "English Wikipedia contributors; see the pinned revision history.",
        },
      };
    } catch (error) {
      if (attempt === 3 || /Wikipedia API 4|^[a-z_-]+:/i.test(error.message)) throw error;
      await pause(Math.min(8_000, 1_000 * 2 ** attempt));
    }
  }
}

async function main() {
  const rawRecords = parseLines(await readFile(inputFile, "utf8")).map((record) => genres ? {
    ...record, title: record.name, article_url: record.source_evidence.article_url,
    article_revision_id: record.source_evidence.article_revision_id ?? null, source_license: record.source_evidence.license,
  } : record);
  let existing = [];
  try { existing = parseLines(await readFile(outputFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const byId = new Map(existing.map((record) => [record.id, record]));
  const idsIndex = process.argv.indexOf("--ids");
  const requestedIds = idsIndex >= 0 ? new Set((process.argv[idsIndex + 1] ?? "").split(",")) : undefined;
  if (requestedIds && [...requestedIds].some((id) => !rawRecords.some((record) => record.id === id))) throw new Error("Unknown record ID in --ids.");
  const pending = rawRecords.filter((record) => (!requestedIds || requestedIds.has(record.id)) &&
    !(genres && !record.article_url && byId.get(record.id)?.enrichment_status === "seed_only" && byId.get(record.id)?.source.seed_revision_id === record.source_evidence.seed_revision_id) &&
    !(byId.get(record.id)?.enrichment_status === "complete" && byId.get(record.id)?.source.extractor_version === extractorVersion &&
      (!record.article_revision_id || byId.get(record.id)?.source.revision_id === record.article_revision_id)));
  await mkdir(corpusDir, { recursive: true });
  let completed = 0;
  let checkpoint = Promise.resolve();
  // Serialize requests and share server-directed cooldowns across the entire run.
  const queue = [...pending];
  await Promise.all(Array.from({ length: 1 }, async () => {
    while (queue.length) {
      const record = queue.shift();
      let article;
      try { article = await fetchArticle(record); }
      catch (error) { article = { id: record.id, title: record.title, enrichment_status: "failed", error: error.message, paragraphs: [] }; }
      // Each response is checkpointed so an interrupted run can be resumed.
      checkpoint = checkpoint.then(() => appendFile(outputFile, `${JSON.stringify(article)}\n`, "utf8"));
      await checkpoint;
      byId.set(record.id, article);
      completed += 1;
      if (completed % 20 === 0 || completed === pending.length) console.log(`Enriched ${completed}/${pending.length} pending works`);
    }
  }));
  const output = rawRecords.map((record) => byId.get(record.id)).filter(Boolean);
  await writeFile(outputFile, `${output.map(JSON.stringify).join("\n")}\n`, "utf8");
  const manifest = {
    corpus_id: `arioso-${dataset.replaceAll("_", "-")}-article-evidence`, schema_version: "0.1.0",
    generated_at: new Date().toISOString(), source_file: path.basename(inputFile), output_file: path.basename(outputFile),
    expected_count: rawRecords.length, record_count: output.length,
    complete_count: output.filter((record) => record.enrichment_status === "complete").length,
    failed_count: output.filter((record) => record.enrichment_status === "failed").length,
    seed_only_count: output.filter((record) => record.enrichment_status === "seed_only").length,
    extraction_method: "Prose paragraphs from pinned MediaWiki article revisions, with section names; tables, block quotations, lyrics and reference sections excluded. Original intro snapshots are preserved separately.",
  };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest));
  if (manifest.failed_count) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
