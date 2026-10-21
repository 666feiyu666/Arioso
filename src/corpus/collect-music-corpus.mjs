#!/usr/bin/env node
// Collect one music type's style and standard collections from Wikipedia.
//
// The pipeline mirrors the Jazz build steps: revision-pinned seed collection,
// article-body evidence extraction, sentence-level musical normalization, and a
// manifest that records every source revision.
//
//   node src/corpus/collect-music-corpus.mjs --type blues
//   node src/corpus/collect-music-corpus.mjs --type all
//   node src/corpus/collect-music-corpus.mjs --type blues --seed-only
//
// Existing article evidence is reused, so an interrupted run can be resumed.

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  articleParagraphs,
  collectMusicalEvidence,
  musicalDescription,
  musicalFeatures,
  readableText,
} from "./jazz-evidence.mjs";

const ROOT = path.resolve(
  process.env.ARIOSO_MUSIC_CORPUS_ROOT ?? path.join("corpus", "music"),
);
const API_URL = "https://en.wikipedia.org/w/api.php";
const REST_URL = "https://en.wikipedia.org/w/rest.php/v1/";
const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ??
  "AriosoMusicCorpus/0.1 (academic research corpus builder)";
const REQUEST_DELAY_MS = Math.max(500, Number(process.env.WIKIMEDIA_REQUEST_DELAY_MS ?? 2_000));
const EXTRACTOR_VERSION = "0.1.0";
const LICENSE = {
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  spdx: "CC-BY-SA-4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

// Sources per music type. `styles` and `standards` each name a collection
// strategy: category members, a genre list page, a work list page, a table on a
// list page, or an explicit whitelist of article titles.
const SOURCES = {
  blues: {
    styles: {
      kind: "category",
      title: "Category:Blues music genres",
      exclude: /^(?:list of|outline of|index of|timeline of)\b/i,
    },
    standards: {
      kind: "table",
      page: "List of blues standards",
      period: "blues standard",
      limit: 60,
    },
  },
  electronic: {
    styles: {
      kind: "genre-list",
      page: "List of electronic music genres",
      sections: ["Genres", "Remix derivatives", "Broader genre groups"],
      exclude: /^(?:list of|outline of|index of|timeline of|music of)\b/i,
      limit: 90,
    },
    standards: {
      kind: "categories",
      titles: [
        "Category:Ambient albums",
        "Category:Dark ambient albums",
        "Category:Drone music albums",
        "Category:Intelligent dance music albums",
        "Category:Downtempo albums",
        "Category:Synthwave albums",
      ],
      limit: 120,
    },
  },
  "instrumental-rock": {
    styles: {
      kind: "pages",
      titles: [
        "Instrumental rock",
        "Surf music",
        "Rautalanka",
        "Post-rock",
        "Math rock",
        "Space rock",
        "Post-metal",
        "Progressive rock",
        "Krautrock",
        "Djent",
      ],
    },
    standards: {
      kind: "table+list",
      page: "List of rock instrumentals",
      period: "rock instrumental",
      limit: 150,
    },
  },
  "instrumental-hip-hop": {
    styles: {
      kind: "pages",
      titles: [
        "Instrumental hip-hop",
        "Lo-fi hip hop",
        "Trip hop",
        "Jazz rap",
        "Chopped and screwed",
        "Abstract hip hop",
      ],
    },
    standards: {
      kind: "categories",
      titles: ["Category:Instrumental hip-hop albums"],
      limit: 80,
    },
  },
};

const DISAMBIGUATION = /\s*\((?:album|EP|mixtape|song|instrumental|composition|soundtrack|record)\)\s*$/i;

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleKey(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function wikiUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function articleTitleFromHref(href) {
  if (!href?.startsWith("/wiki/")) return null;
  const raw = href.slice("/wiki/".length).split("#", 1)[0];
  if (!raw || raw.includes(":")) return null;
  return decodeURIComponent(raw).replaceAll("_", " ");
}

function cleanTitle(value) {
  return value.replace(DISAMBIGUATION, "").replace(/\s+/g, " ").trim();
}

function parseJsonLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serialize every request and share server-directed cooldowns across the run.
let nextRequestAt = Date.now();

async function requestJson(url, headers) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await sleep(Math.max(0, nextRequestAt - Date.now()));
    nextRequestAt = Date.now() + REQUEST_DELAY_MS;
    let response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: "application/json", ...headers },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 5) throw error;
      nextRequestAt = Date.now() + 2_000 * 2 ** attempt;
      continue;
    }
    const text = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : Math.min(60_000, 5_000 * 2 ** attempt);
      console.warn(`Wikipedia ${response.status}; waiting ${Math.ceil(wait / 1_000)}s`);
      nextRequestAt = Date.now() + wait;
      continue;
    }
    if (!response.ok) {
      throw new Error(`Wikipedia ${response.status}: ${text.slice(0, 120)}`);
    }
    return JSON.parse(text);
  }
  throw new Error("Wikipedia request failed after retries.");
}

async function actionJson(params) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) {
    url.searchParams.set(key, value);
  }
  const data = await requestJson(url);
  if (data.error) throw new Error(`${data.error.code}: ${data.error.info}`);
  return data;
}

async function restJson(route) {
  return requestJson(new URL(route, REST_URL));
}

async function fetchParsedPage(page) {
  const data = await actionJson({ action: "parse", page, prop: "text|revid", redirects: "1", disabletoc: "1" });
  if (!data.parse?.text) throw new Error(`Could not parse page: ${page}`);
  return { html: data.parse.text, revisionId: data.parse.revid, source: { title: page, url: wikiUrl(page) } };
}

async function categoryMembers(title) {
  const members = [];
  let continuation;
  do {
    const data = await actionJson({
      action: "query",
      list: "categorymembers",
      cmtitle: title,
      cmlimit: "500",
      cmtype: "page",
      ...(continuation ? { cmcontinue: continuation } : {}),
    });
    members.push(...(data.query?.categorymembers ?? []).filter((member) => member.ns === 0));
    continuation = data.continue?.cmcontinue;
  } while (continuation && members.length < 600);
  return members.map((member) => member.title);
}

function seedRecord({ musicType, kind, title, articleTitle, year, period, description, seedPage }) {
  const label = kind === "style" ? "style" : "standard";
  return {
    id: `${musicType}-${label}-${slugify(title)}`,
    record_type: `${musicType.replaceAll("-", "_")}_${label}`,
    title,
    year: year ?? null,
    period: period ?? null,
    article_title: articleTitle,
    article_url: wikiUrl(articleTitle),
    seed_evidence: description || seedPage
      ? [{
        seed_page_title: seedPage?.title ?? null,
        seed_page_url: seedPage?.url ?? null,
        seed_page_revision_id: seedPage?.revisionId ?? null,
        seed_page_revision_url: seedPage?.revisionId ? `${seedPage.url}?oldid=${seedPage.revisionId}` : null,
        list_description: description ?? "",
        retrieved_at: new Date().toISOString(),
      }]
      : [],
  };
}

// --- collection strategies ------------------------------------------------

function htmlListItems(html) {
  // Track <ul> nesting so a nested genre can name its parent style.
  const tokens = [...html.matchAll(/<(\/?)ul\b[^>]*>|<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  const stack = [];
  const items = [];
  for (const token of tokens) {
    if (token[1] === "" && token[0].startsWith("<ul")) {
      stack.push(null);
      continue;
    }
    if (token[1] === "/" && token[0].startsWith("</ul")) {
      stack.pop();
      continue;
    }
    const content = token[2];
    if (content === undefined) continue;
    const link = content.match(/<a\b[^>]*href="\/wiki\/([^"#]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    items.push({
      articleTitle: articleTitleFromHref(`/wiki/${link[1]}`),
      label: readableText(link[2]),
      text: readableText(content),
      depth: stack.length,
      parent: stack.slice(0, -1).reverse().find(Boolean) ?? null,
    });
  }
  return items;
}

function sectionRange(html, headings) {
  const matches = [...html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({
      index: match.index,
      title: readableText(match[2]).replace(/\[edit\]/gi, "").trim(),
    }))
    .filter((heading) => heading.title);
  let start = null;
  let end = html.length;
  for (const [index, heading] of matches.entries()) {
    const wanted = headings.some((name) => heading.title.toLowerCase() === name.toLowerCase());
    if (start === null && wanted) start = heading.index;
    else if (start !== null && index > 0) {
      end = heading.index;
      break;
    }
  }
  return start === null ? null : html.slice(start, end);
}

async function collectGenreListStyles(musicType, config) {
  const page = await fetchParsedPage(config.page);
  const section = sectionRange(page.html, config.sections);
  if (!section) throw new Error(`Could not locate the genre sections in ${config.page}`);
  const seen = new Set();
  const records = [];
  for (const item of htmlListItems(section)) {
    if (!item.articleTitle || (config.exclude && config.exclude.test(item.articleTitle))) continue;
    if (item.depth > 4) continue;
    const key = titleKey(item.articleTitle);
    if (seen.has(key)) continue;
    seen.add(key);
    const description = item.text.replace(item.label, "").replace(/^[\s,;:–-]+/, "").trim();
    records.push(seedRecord({
      musicType,
      kind: "style",
      title: cleanTitle(item.label || item.articleTitle),
      articleTitle: item.articleTitle,
      period: item.parent ? `Subgenre of ${item.parent}` : null,
      description: description || null,
      seedPage: page.source,
    }));
  }
  return sampleEvenly(records, config.limit);
}

async function collectCategoryStyles(musicType, config) {
  const titles = (await categoryMembers(config.title))
    .filter((title) => !DISAMBIGUATION.test(title))
    .filter((title) => !(config.exclude && config.exclude.test(title)));
  return titles.map((title) => seedRecord({
    musicType,
    kind: "style",
    title,
    articleTitle: title,
    seedPage: { title: config.title, url: wikiUrl(config.title), revisionId: null },
  }));
}

async function collectPageStyles(musicType, config) {
  return config.titles.map((title) => seedRecord({ musicType, kind: "style", title, articleTitle: title }));
}

function parseBluesStandardsTable(html) {
  const table = html.match(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];
  return table.split("</tr>").slice(1).map((row) => {
    const cells = [...row.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
    if (cells.length < 3) return null;
    const heading = cells[0];
    const link = heading.match(/<a\b[^>]*href="\/wiki\/([^"#]+)"/);
    if (!link) return null;
    const text = readableText(heading).replace(/^["“]|["”]$/g, "").trim();
    const year = Number(readableText(cells[2]).match(/\b(\d{4})\b/)?.[1]) || null;
    const artist = readableText(cells[1]).trim();
    return {
      title: text,
      articleTitle: articleTitleFromHref(`/wiki/${link[1]}`),
      year,
      description: [text, artist, year].filter(Boolean).join(" — "),
    };
  }).filter(Boolean);
}

function parseRockInstrumentals(html) {
  const records = [];
  const tables = [...html.matchAll(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi)];
  for (const table of tables) {
    for (const row of table[0].split("</tr>").slice(1)) {
      const cells = [...row.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
      if (cells.length < 3) continue;
      const link = cells[1].match(/<a\b[^>]*href="\/wiki\/([^"#]+)"/);
      if (!link) continue;
      const title = cleanTitle(readableText(cells[1]).replace(/^["“]|["”]$/g, "").trim());
      const year = Number(readableText(cells[2]).match(/\b(\d{4})\b/)?.[1]) || null;
      const artist = readableText(cells[0]).trim();
      records.push({
        title,
        articleTitle: articleTitleFromHref(`/wiki/${link[1]}`),
        year,
        description: [title, artist, year].filter(Boolean).join(" — "),
      });
    }
  }

  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const content = match[1];
    if (!/^\s*["“]/.test(readableText(content))) continue;
    const quoted = content.match(/["“]([\s\S]*?)["”]/);
    if (!quoted) continue;
    const quotedLink = quoted[1].match(/<a\b[^>]*href="\/wiki\/([^"#]+)"/);
    if (!quotedLink) continue;
    const title = cleanTitle(readableText(quoted[1]).replace(/^["“]|["”]$/g, "").trim());
    if (!title) continue;
    const year = Number(readableText(content).match(/,\s*(\d{4})\)/)?.[1]) || null;
    records.push({
      title,
      articleTitle: articleTitleFromHref(`/wiki/${quotedLink[1]}`),
      year,
      description: readableText(content),
    });
  }
  return records;
}

function sampleEvenly(items, limit) {
  if (!limit || items.length <= limit) return items;
  const step = items.length / limit;
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * step)]);
}

async function collectStandards(musicType, config) {
  let candidates = [];
  let seedPage = null;
  if (config.kind === "table") {
    const page = await fetchParsedPage(config.page);
    seedPage = { ...page.source, revisionId: page.revisionId };
    candidates = parseBluesStandardsTable(page.html);
  } else if (config.kind === "table+list") {
    const page = await fetchParsedPage(config.page);
    seedPage = { ...page.source, revisionId: page.revisionId };
    candidates = parseRockInstrumentals(page.html);
  } else if (config.kind === "categories") {
    const titles = [];
    for (const category of config.titles) titles.push(...(await categoryMembers(category)));
    candidates = titles.map((title) => ({
      title: cleanTitle(title),
      articleTitle: title,
      year: null,
      description: `Album page listed in the associated genre category: ${title}`,
    }));
  } else {
    throw new Error(`Unsupported standards source: ${config.kind}`);
  }

  const seen = new Set();
  const unique = candidates.filter((candidate) => {
    if (!candidate.articleTitle) return false;
    const key = titleKey(candidate.articleTitle);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return sampleEvenly(unique, config.limit).map((candidate) => seedRecord({
    musicType,
    kind: "standard",
    title: candidate.title,
    articleTitle: candidate.articleTitle,
    year: candidate.year,
    period: config.period,
    description: candidate.description,
    seedPage,
  }));
}

// --- enrichment -----------------------------------------------------------

async function enrichIntros(records) {
  const enriched = [];
  const batchSize = 20;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    const data = await actionJson({
      action: "query",
      prop: "extracts|revisions",
      titles: batch.map((record) => record.article_title).join("|"),
      redirects: "1",
      exintro: "1",
      explaintext: "1",
      exsentences: "5",
      exlimit: "max",
      rvprop: "ids|timestamp",
    });
    const aliases = new Map();
    for (const item of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
      aliases.set(titleKey(item.from), titleKey(item.to));
    }
    const pages = new Map((data.query?.pages ?? []).map((page) => [titleKey(page.title), page]));
    for (const record of batch) {
      let key = titleKey(record.article_title);
      for (let hops = 0; aliases.has(key) && hops < 5; hops += 1) key = aliases.get(key);
      const page = pages.get(key);
      if (!page || page.missing) {
        enriched.push({ ...record, article_extract: null, article_revision_id: null, enrichment_status: "missing" });
        continue;
      }
      enriched.push({
        ...record,
        article_title: page.title,
        article_url: wikiUrl(page.title),
        article_extract: page.extract?.trim() || null,
        article_revision_id: page.revisions?.[0]?.revid ?? null,
        article_revision_timestamp: page.revisions?.[0]?.timestamp ?? null,
        enrichment_status: page.extract ? "complete" : "no_extract",
      });
    }
    console.log(`  intro enrichment ${Math.min(index + batch.length, records.length)}/${records.length}`);
  }
  return enriched;
}

async function collectArticleEvidence(records, outputFile) {
  let existing = [];
  try {
    existing = parseJsonLines(await readFile(outputFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const byId = new Map(existing.map((article) => [article.id, article]));
  const isFresh = (record, article) =>
    article?.enrichment_status === "complete" &&
    article.source?.extractor_version === EXTRACTOR_VERSION &&
    article.source?.revision_id === record.article_revision_id;
  const pending = records.filter((record) => record.article_revision_id && !isFresh(record, byId.get(record.id)));

  for (const [index, record] of pending.entries()) {
    let article;
    try {
      const data = await restJson(`revision/${record.article_revision_id}/with_html`);
      const paragraphs = articleParagraphs(data.html ?? "");
      if (!paragraphs.length) throw new Error("No article prose was returned.");
      article = {
        id: record.id,
        title: record.title,
        enrichment_status: "complete",
        paragraphs,
        source: {
          article_title: data.page?.title ?? record.article_title,
          article_url: record.article_url,
          revision_id: data.id ?? record.article_revision_id,
          revision_url: `${record.article_url}?oldid=${data.id ?? record.article_revision_id}`,
          api_url: `${REST_URL}revision/${record.article_revision_id}/with_html`,
          extractor_version: EXTRACTOR_VERSION,
          retrieved_at: new Date().toISOString(),
          license: data.license ?? LICENSE,
          attribution: "English Wikipedia contributors; see the pinned revision history.",
        },
      };
    } catch (error) {
      article = {
        id: record.id,
        title: record.title,
        enrichment_status: "failed",
        error: error.message,
        paragraphs: [],
      };
    }
    byId.set(record.id, article);
    await appendFile(outputFile, `${JSON.stringify(article)}\n`, "utf8");
    if ((index + 1) % 10 === 0 || index + 1 === pending.length) {
      console.log(`  article evidence ${index + 1}/${pending.length}`);
    }
  }

  const output = records.map((record) => byId.get(record.id)).filter(Boolean);
  await writeFile(outputFile, `${output.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  return output;
}

// --- normalization --------------------------------------------------------

/** True when the intro and seed evidence do not yet describe two musical dimensions. */
function needsArticleBody(record) {
  const evidence = collectMusicalEvidence(record, undefined);
  const features = new Set(evidence.flatMap((item) => musicalFeatures(item.text, record.title)));
  return features.size < 2;
}

function normalizedRecord(record, article) {
  const usableArticle = article?.enrichment_status === "complete" &&
    (!record.article_revision_id || article.source?.revision_id === record.article_revision_id)
    ? article
    : undefined;
  const evidence = collectMusicalEvidence(record, usableArticle);
  const description = musicalDescription(evidence, record.title);
  const features = [...new Set(evidence.flatMap((item) => musicalFeatures(item.text, record.title)))];
  return {
    id: record.id,
    record_type: record.record_type,
    title: record.title,
    year: record.year ?? null,
    period: record.period ?? null,
    musical_description: description,
    musical_evidence: evidence,
    evidence_type: "source_excerpt",
    musical_features: features,
    normalization_status: description ? "complete" : "insufficient_musical_evidence",
    source: {
      article_url: record.article_url ?? null,
      article_revision_id: record.article_revision_id ?? null,
      article_revision_url: record.article_revision_id ? `${record.article_url}?oldid=${record.article_revision_id}` : null,
      seed_revision_urls: [...new Set((record.seed_evidence ?? []).map((item) => item.seed_page_revision_url).filter(Boolean))],
      license: LICENSE,
      attribution: "English Wikipedia contributors; see the pinned revision histories.",
    },
  };
}

// --- per-type orchestration ----------------------------------------------

async function collectKind(musicType, kind, config, directory, options) {
  const label = kind === "style" ? "styles" : "standards";
  console.log(`${musicType}/${label}: collecting seed records from ${config.kind} source`);
  let records;
  if (config.kind === "category") records = await collectCategoryStyles(musicType, config);
  else if (config.kind === "genre-list") records = await collectGenreListStyles(musicType, config);
  else if (config.kind === "pages") records = await collectPageStyles(musicType, config);
  else records = await collectStandards(musicType, config);

  if (!records.length) throw new Error(`No ${label} records were collected for ${musicType}.`);

  const enriched = await enrichIntros(records);
  const rawFile = path.join(directory, `${label}.raw.jsonl`);
  await writeFile(rawFile, `${enriched.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  console.log(`${musicType}/${label}: wrote ${enriched.length} raw records`);

  let articles = [];
  if (!options.seedOnly) {
    // Style records are small in number and benefit most from full article
    // prose; standard records only need a body when the intro evidence is thin.
    const bodyTargets = kind === "style" ? enriched : enriched.filter(needsArticleBody);
    console.log(`${musicType}/${label}: fetching article bodies for ${bodyTargets.length} records`);
    articles = await collectArticleEvidence(bodyTargets, path.join(directory, `${label}.article_evidence.jsonl`));
  }
  const byId = new Map(articles.map((article) => [article.id, article]));
  const normalized = enriched.map((record) => normalizedRecord(record, byId.get(record.id)));
  const normalizedFile = path.join(directory, `${label}.normalized.jsonl`);
  await writeFile(normalizedFile, `${normalized.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");

  const complete = normalized.filter((record) => record.normalization_status === "complete");
  const manifest = {
    corpus_id: `arioso-${musicType}-${label}`,
    schema_version: "0.1.0",
    music_type: musicType,
    reference_kind: kind,
    generated_at: new Date().toISOString(),
    source_kind: config.kind,
    source_pages: config.page ? [config.page] : config.titles ?? [],
    record_count: normalized.length,
    complete_count: complete.length,
    insufficient_evidence_count: normalized.length - complete.length,
    article_body_count: articles.filter((article) => article.enrichment_status === "complete").length,
    article_body_failed_count: articles.filter((article) => article.enrichment_status === "failed").length,
    feature_coverage: Object.fromEntries(
      ["harmony", "rhythm", "melody", "form", "instrumentation", "arrangement", "style", "mood"]
        .map((feature) => [feature, normalized.filter((record) => record.musical_features.includes(feature)).length]),
    ),
    seed_only: options.seedOnly,
    license: LICENSE,
    attribution: "English Wikipedia contributors; see the pinned revision histories.",
    extraction_method: "Revision-pinned seed records, five-sentence intro snapshots, prose paragraphs from pinned article revisions, and sentence-level musical evidence filtering. Tables, block quotations, lyrics and reference sections are excluded.",
    normalization_method: "Musical sentences only: rhythm, harmony, melody, instrumentation, texture, form and production. Biography, chart and sales narrative is excluded unless the sentence also carries audible or compositional detail.",
  };
  await writeFile(path.join(directory, `${label}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`${musicType}/${label}: ${complete.length}/${normalized.length} records with musical evidence`);
  return manifest;
}

async function collectType(musicType, options) {
  const config = SOURCES[musicType];
  if (!config) throw new Error(`Unknown music type: ${musicType}`);
  const directory = path.join(ROOT, musicType);
  await mkdir(directory, { recursive: true });
  const styles = await collectKind(musicType, "style", config.styles, directory, options);
  const standards = await collectKind(musicType, "standard", config.standards, directory, options);
  const summary = {
    corpus_id: `arioso-${musicType}-collection`,
    music_type: musicType,
    generated_at: new Date().toISOString(),
    styles: { record_count: styles.record_count, complete_count: styles.complete_count },
    standards: { record_count: standards.record_count, complete_count: standards.complete_count },
    runtime_files: ["styles.normalized.jsonl", "standards.normalized.jsonl"],
  };
  await writeFile(path.join(directory, "collection.manifest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary));
  return summary;
}

async function main() {
  const typeIndex = process.argv.indexOf("--type");
  const requested = typeIndex >= 0 ? process.argv[typeIndex + 1] : "all";
  const types = requested === "all" ? Object.keys(SOURCES) : [requested];
  const options = { seedOnly: process.argv.includes("--seed-only") };
  for (const musicType of types) {
    await collectType(musicType, options);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
