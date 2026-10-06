import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://en.wikipedia.org/w/api.php";
const OUTPUT_DIR = path.resolve("corpus", "jazz");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "jazz_standards.raw.jsonl");
const MANIFEST_FILE = path.join(OUTPUT_DIR, "jazz_standards.manifest.json");
const REQUEST_DELAY_MS = Number(process.env.WIKIMEDIA_REQUEST_DELAY_MS ?? 350);
const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ??
  "AriosoJazzCorpus/0.1 (local academic corpus builder)";
const ENRICH_ARTICLES = !process.argv.includes("--seed-only");
const REFRESH_TEXT_ONLY = process.argv.includes("--refresh-text");

const SEED_PAGES = [
  { title: "List of pre-1920 jazz standards", period: "pre-1920" },
  { title: "List of 1920s jazz standards", period: "1920s" },
  { title: "List of 1930s jazz standards", period: "1930s" },
  { title: "List of 1940s jazz standards", period: "1940s" },
  { title: "List of post-1950 jazz standards", period: "post-1950" },
];

const LICENSE = {
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  spdx: "CC-BY-SA-4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function plainText(html) {
  return decodeHtml(
    html
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function articleText(html) {
  const fractionAwareHtml = html.replace(
    /<sup\b[^>]*>([\s\S]*?)<\/sup>\s*<br\s*\/?>\s*<sub\b[^>]*>([\s\S]*?)<\/sub>/gi,
    (_, numerator, denominator) => {
      const inlineText = (value) =>
        decodeHtml(value.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim());
      return `${inlineText(numerator)}/${inlineText(denominator)}`;
    },
  );
  return decodeHtml(
    fractionAwareHtml
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim(),
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function wikiUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function articleTitleFromHref(href) {
  if (!href?.startsWith("/wiki/")) return null;
  const rawTitle = href.slice("/wiki/".length).split("#", 1)[0];
  if (!rawTitle || rawTitle.includes(":")) return null;
  return decodeURIComponent(rawTitle).replaceAll("_", " ");
}

function normalizeTitle(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function getJson(params, attempt = 0) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    origin: "*",
    format: "json",
    formatversion: "2",
    ...params,
  });

  const response = await fetch(url, {
    headers: {
      "Api-User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(60_000, 2 ** attempt * 2_000);
    console.warn(
      `Wikipedia API ${response.status}; retrying in ${Math.ceil(waitMs / 1000)}s`,
    );
    await delay(waitMs);
    return getJson(params, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`Wikipedia API ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function selectWorkLink(liHtml, workTitle) {
  const links = [...liHtml.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: decodeHtml(match[1]),
      label: plainText(match[2]),
    }))
    .map((link) => ({ ...link, articleTitle: articleTitleFromHref(link.href) }))
    .filter((link) => link.articleTitle);

  const expected = normalizeTitle(workTitle);
  return (
    links.find((link) => normalizeTitle(link.label) === expected) ??
    links.find((link) => normalizeTitle(link.articleTitle) === expected) ??
    links[0] ??
    null
  );
}

function parseStandards(html, seed) {
  const records = [];
  const listItems = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];

  for (const match of listItems) {
    const liHtml = match[1];
    const description = plainText(liHtml);
    const heading = description.match(
      /^(?:(\d{4})\s*[–—-]\s*)?["“]([^"”]+)["”]/,
    );
    if (!heading) continue;

    const year = heading[1] ? Number(heading[1]) : null;
    const title = heading[2].trim();
    const link = selectWorkLink(liHtml, title);
    if (!link) continue;

    records.push({
      id: `jazz-standard-${slugify(title)}`,
      record_type: "jazz_standard",
      title,
      year,
      period: seed.period,
      article_title: link.articleTitle,
      article_url: wikiUrl(link.articleTitle),
      list_description: description,
    });
  }

  return records;
}

async function fetchSeedPage(seed, retrievedAt) {
  const data = await getJson({
    action: "parse",
    page: seed.title,
    prop: "text|revid",
    disabletoc: "1",
  });
  const revisionId = data.parse.revid;
  return {
    records: parseStandards(data.parse.text, seed),
    source: {
      title: seed.title,
      period: seed.period,
      url: wikiUrl(seed.title),
      revision_id: revisionId,
      revision_url: `${wikiUrl(seed.title)}?oldid=${revisionId}`,
      retrieved_at: retrievedAt,
    },
  };
}

async function enrichArticleBatch(records, retrievedAt) {
  const data = await getJson({
    action: "query",
    prop: "extracts|revisions",
    titles: records.map((record) => record.article_title).join("|"),
    redirects: "1",
    exintro: "1",
    exsentences: "5",
    exlimit: "max",
    rvprop: "ids|timestamp",
  });

  const aliases = new Map();
  for (const item of [
    ...(data.query.normalized ?? []),
    ...(data.query.redirects ?? []),
  ]) {
    aliases.set(normalizeTitle(item.from), normalizeTitle(item.to));
  }
  const pages = new Map(
    data.query.pages.map((page) => [normalizeTitle(page.title), page]),
  );

  return records.map((record) => {
    let key = normalizeTitle(record.article_title);
    for (let index = 0; aliases.has(key) && index < 5; index += 1) {
      key = aliases.get(key);
    }
    const page = pages.get(key);
    if (!page || page.missing) {
      return {
        ...record,
        article_extract: null,
        article_extract_html: null,
        article_revision_id: null,
        article_revision_timestamp: null,
        article_retrieved_at: retrievedAt,
        enrichment_status: "missing",
      };
    }

    const revision = page.revisions?.[0];
    const extractHtml = page.extract?.trim() || null;
    return {
      ...record,
      article_title: page.title,
      article_url: wikiUrl(page.title),
      article_extract: extractHtml ? articleText(extractHtml) : null,
      article_extract_html: extractHtml,
      article_revision_id: revision?.revid ?? null,
      article_revision_timestamp: revision?.timestamp ?? null,
      article_retrieved_at: retrievedAt,
      enrichment_status: extractHtml ? "complete" : "no_extract",
    };
  });
}

function mergeRecords(allSeedRecords) {
  const merged = new Map();
  for (const { record, source } of allSeedRecords) {
    const key = normalizeTitle(record.article_title || record.title);
    const seedEvidence = {
      seed_page_title: source.title,
      seed_page_url: source.url,
      seed_page_revision_id: source.revision_id,
      seed_page_revision_url: source.revision_url,
      list_description: record.list_description,
      retrieved_at: source.retrieved_at,
    };

    if (!merged.has(key)) {
      const { list_description, ...base } = record;
      merged.set(key, {
        ...base,
        seed_evidence: [seedEvidence],
      });
    } else {
      merged.get(key).seed_evidence.push(seedEvidence);
    }
  }
  return [...merged.values()];
}

async function main() {
  if (REFRESH_TEXT_ONLY) {
    const existing = (await readFile(OUTPUT_FILE, "utf8"))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(JSON.parse)
      .map((record) => ({
        ...record,
        article_extract: record.article_extract_html
          ? articleText(record.article_extract_html)
          : record.article_extract,
      }));
    await writeFile(
      OUTPUT_FILE,
      `${existing.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8",
    );
    console.log(`Refreshed readable text for ${existing.length} works`);
    return;
  }

  const retrievedAt = new Date().toISOString();
  const seedResults = [];

  for (const seed of SEED_PAGES) {
    const result = await fetchSeedPage(seed, retrievedAt);
    seedResults.push(result);
    console.log(`${seed.title}: ${result.records.length} candidate works`);
    await delay(REQUEST_DELAY_MS);
  }

  const records = mergeRecords(
    seedResults.flatMap((result) =>
      result.records.map((record) => ({ record, source: result.source })),
    ),
  );

  let enrichedRecords = records.map((record) => ({
      ...record,
      article_extract: null,
      article_extract_html: null,
      article_revision_id: null,
      article_revision_timestamp: null,
      article_retrieved_at: null,
      enrichment_status: "seed_only",
    }));

  if (ENRICH_ARTICLES) {
    enrichedRecords = [];
    const batchSize = 20;
    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      enrichedRecords.push(...(await enrichArticleBatch(batch, retrievedAt)));
      console.log(
        `Enriched ${Math.min(index + batch.length, records.length)}/${records.length} works`,
      );
      await delay(REQUEST_DELAY_MS);
    }
  }

  const output = enrichedRecords.map((enriched) => ({
      ...enriched,
      source_license: LICENSE,
      normalization_status: "pending",
      style_links: [],
      style_link_status: "pending",
    }));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    `${output.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );

  const manifest = {
    corpus_id: "arioso-jazz-standards",
    schema_version: "0.1.0",
    record_type: "jazz_standard",
    record_count: output.length,
    generated_at: retrievedAt,
    output_file: "jazz_standards.raw.jsonl",
    enriched_article_intros: ENRICH_ARTICLES,
    seed_pages: seedResults.map((result) => result.source),
    license: LICENSE,
    attribution:
      "Source text and article extracts are from English Wikipedia contributors; see each pinned revision URL for attribution history.",
    extraction_method:
      "MediaWiki Action API parse output for standards lists; article intro HTML, readable text, and revision enrichment through the Action API.",
    normalization_status: "pending",
    style_link_status: "pending",
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Wrote ${output.length} works to ${OUTPUT_FILE}`);
  console.log(`Wrote manifest to ${MANIFEST_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
