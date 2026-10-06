#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://en.wikipedia.org/w/api.php";
const SEED_PAGE = "List of jazz genres";
const LICENSE = "CC BY-SA 4.0";
const DEFAULT_OUTPUT_DIR = path.resolve("corpus", "jazz");
const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ??
  "AriosoJazzCorpus/0.1 (academic research corpus builder)";

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    ndash: "–",
    mdash: "—",
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function textContent(html) {
  return decodeHtml(
    html
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function absoluteWikiUrl(href) {
  return new URL(href, "https://en.wikipedia.org").toString();
}

async function getJson(params) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchSeedTable() {
  const data = await getJson({
    action: "parse",
    page: SEED_PAGE,
    prop: "text|revid",
    format: "json",
    formatversion: "2",
  });

  const html = data.parse?.text;
  const table = html?.match(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) {
    throw new Error("Could not find the jazz-genre table in the seed page.");
  }

  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .map((rowHtml) => [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cell[1]))
    .filter((cells) => cells.length >= 3 && textContent(cells[0]).toLowerCase() !== "genre")
    .map(([genreCell, characteristicsCell, eraCell]) => {
      const link = genreCell.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const name = textContent(link?.[2] ?? genreCell);
      return {
        id: `jazz-style-${slugify(name)}`,
        type: "jazz_style",
        name,
        era: textContent(eraCell),
        source_evidence: {
          characteristics: textContent(characteristicsCell),
          article_url: link ? absoluteWikiUrl(link[1]) : null,
          seed_page_url: "https://en.wikipedia.org/wiki/List_of_jazz_genres",
          seed_revision_id: data.parse.revid,
          retrieved_at: new Date().toISOString(),
          license: LICENSE,
        },
        normalization_status: "pending",
      };
    });

  return { rows, revisionId: data.parse.revid };
}

async function enrichArticle(record) {
  if (!record.source_evidence.article_url) return record;
  const title = decodeURIComponent(new URL(record.source_evidence.article_url).pathname.slice(6)).replaceAll("_", " ");
  const data = await getJson({
    action: "query",
    prop: "extracts|revisions",
    titles: title,
    redirects: "1",
    exintro: "1",
    explaintext: "1",
    exsentences: "5",
    rvprop: "ids|timestamp",
    format: "json",
    formatversion: "2",
  });
  const page = data.query?.pages?.[0];
  const revision = page?.revisions?.[0];

  return {
    ...record,
    source_evidence: {
      ...record.source_evidence,
      article_title: page?.title ?? title,
      article_intro: page?.extract?.trim() ?? "",
      article_revision_id: revision?.revid ?? null,
      article_revision_timestamp: revision?.timestamp ?? null,
    },
  };
}

async function main() {
  const outputArgIndex = process.argv.indexOf("--output-dir");
  const outputDir =
    outputArgIndex >= 0 && process.argv[outputArgIndex + 1]
      ? path.resolve(process.argv[outputArgIndex + 1])
      : DEFAULT_OUTPUT_DIR;
  const enrich = !process.argv.includes("--seed-only");

  const { rows, revisionId } = await fetchSeedTable();
  const records = [];
  for (const row of rows) {
    records.push(enrich ? await enrichArticle(row) : row);
  }

  records.sort((a, b) => a.name.localeCompare(b.name, "en"));
  await mkdir(outputDir, { recursive: true });
  const jsonlPath = path.join(outputDir, "jazz_genres.raw.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");
  const jsonl = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const manifest = {
    corpus_id: "arioso-jazz-genres-wikipedia",
    schema_version: 1,
    record_count: records.length,
    generated_at: new Date().toISOString(),
    seed_page: SEED_PAGE,
    seed_page_url: "https://en.wikipedia.org/wiki/List_of_jazz_genres",
    seed_revision_id: revisionId,
    enrichment_enabled: enrich,
    license: LICENSE,
    attribution: "Wikipedia contributors, List of jazz genres and linked articles",
    files: [path.basename(jsonlPath)],
  };

  await Promise.all([
    writeFile(jsonlPath, jsonl, "utf8"),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write(`Wrote ${records.length} records to ${jsonlPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
