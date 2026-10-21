#!/usr/bin/env node
// Build the modern-poetry retrieval corpus for MoodMic from one pinned upstream
// source (sheepzh/poetry). The importer never rewrites the source poems: it only
// samples, cleans and annotates them so retrieval stays reproducible.
//
//   node scripts/import-modern-poetry.mjs
//
// Environment:
//   ARIOSO_POETRY_SOURCE  existing clone (bare or working tree) to read instead
//                         of cloning the upstream repository
//   ARIOSO_POETRY_CACHE   where the bare clone is cached when no source is given

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const REPOSITORY = "sheepzh/poetry";
// Pinned so a later upstream change cannot silently alter retrieval results.
const PINNED_COMMIT = "a40636aeb393cb1a34817a6f1b4855e29ef78504";
const REPOSITORY_URL = `https://github.com/${REPOSITORY}.git`;
const SCHEMA_VERSION = "1.0";
const IMPORTER_VERSION = "1.0.0";

const OUTPUT_DIR = path.resolve(process.env.ARIOSO_POEM_OUTPUT ?? path.join("corpus", "poem"));
const NORMALIZED_FILE = "modern_poems.normalized.jsonl";
const MANIFEST_FILE = "modern_poems.manifest.json";
// Curated input, not generated output: it stays next to the songs it annotates.
const LEXICON_FILE = path.resolve(
  process.env.ARIOSO_POEM_LEXICON ?? path.join("corpus", "poem", "mood-lexicon.json"),
);

const MINIMUM_RECORDS = 500;
const TARGET_RECORDS = 630;

const CORE_POETS = [
  "戴望舒", "徐志摩", "林徽因", "闻一多",
  "卞之琳", "何其芳", "郑愁予", "北岛",
  "顾城", "舒婷", "海子", "余秀华",
];
const DIVERSITY_POETS = [
  "冯至", "穆旦", "艾青", "郭沫若",
  "余光中", "痖弦", "洛夫", "席慕蓉",
  "食指", "芒克", "昌耀", "多多",
  "西川", "于坚", "翟永明", "韩东",
  "王小妮", "欧阳江河",
];
const CORE_LIMIT = 30;
const DIVERSITY_LIMIT = 15;

const ANCHOR_WORKS = {
  戴望舒: ["雨巷", "寻梦者", "烦忧", "我用残损的手掌"],
  徐志摩: ["再别康桥", "偶然", "雪花的快乐", "沙扬娜拉"],
  林徽因: ["你是人间的四月天", "笑"],
  闻一多: ["红烛", "死水"],
  卞之琳: ["断章", "鱼化石"],
  何其芳: ["预言", "秋天"],
  郑愁予: ["错误", "如雾起时"],
  北岛: ["回答", "一切", "迷途"],
  顾城: ["一代人", "远和近", "弧线"],
  舒婷: ["致橡树", "双桅船"],
  海子: ["面朝大海，春暖花开", "九月", "麦地"],
  余秀华: ["我爱你", "穿过大半个中国去睡你"],
};

function log(message) {
  process.stderr.write(`${message}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function git(repository, args) {
  return execFileSync(
    "git",
    ["-C", repository, "-c", "core.quotepath=false", ...args],
    { maxBuffer: 1024 * 1024 * 512, encoding: "utf8" },
  );
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function hasCommit(repository) {
  try {
    git(repository, ["cat-file", "-e", `${PINNED_COMMIT}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a local clone that contains the pinned commit, cloning a bare copy when needed. */
async function resolveSource() {
  const configured = process.env.ARIOSO_POETRY_SOURCE;
  if (configured) {
    const source = path.resolve(configured);
    if (!hasCommit(source)) {
      throw new Error(`${source} does not contain the pinned commit ${PINNED_COMMIT}.`);
    }
    return source;
  }
  const cache = path.resolve(
    process.env.ARIOSO_POETRY_CACHE ?? path.join(tmpdir(), "arioso-poetry-source.git"),
  );
  if (hasCommit(cache)) return cache;
  await rm(cache, { recursive: true, force: true });
  log(`Cloning ${REPOSITORY_URL} (bare) into ${cache} ...`);
  execFileSync("git", ["clone", "--quiet", "--bare", REPOSITORY_URL, cache], { stdio: ["ignore", "ignore", "inherit"] });
  if (!hasCommit(cache)) {
    throw new Error(`The clone at ${cache} does not contain ${PINNED_COMMIT}.`);
  }
  return cache;
}

/**
 * Read many blobs at once. `git cat-file --batch` keeps the file names as bytes,
 * which matters because the upstream tree contains names Windows cannot store.
 */
function readBlobs(repository, paths) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repository, "cat-file", "--batch"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git cat-file --batch failed (${code}): ${stderr.trim()}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    for (const file of paths) child.stdin.write(`${PINNED_COMMIT}:${file}\n`);
    child.stdin.end();
  });
}

function parseBatchOutput(buffer) {
  const contents = new Map();
  let offset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline === -1) break;
    const header = buffer.subarray(offset, newline).toString("utf8");
    offset = newline + 1;
    const parts = header.split(" ");
    if (parts.length === 2 && parts[1] === "missing") continue;
    const size = Number(parts.at(-1));
    if (!Number.isFinite(size)) throw new Error(`Unexpected git cat-file header: ${header}`);
    // The requested object name is echoed only for ambiguous input; recover the
    // path by consumed order instead of relying on the header format.
    contents.set(offset, buffer.subarray(offset, offset + size).toString("utf8"));
    offset += size + 1;
  }
  return contents;
}

async function readPoems(repository, paths) {
  const buffer = await readBlobs(repository, paths);
  const values = parseBatchOutput(buffer);
  if (values.size !== paths.length) {
    throw new Error(`Expected ${paths.length} blobs from the pinned commit, received ${values.size}.`);
  }
  const ordered = [...values.values()];
  return new Map(paths.map((file, index) => [file, ordered[index]]));
}

function normalizeTitleKey(value) {
  return value
    .normalize("NFKC")
    .replace(/[\s《》〈〉「」『』“”‘’"'·、，,。.！!？?：:；;—\-－()（）[\]]/gu, "")
    .toLowerCase();
}

function parsePoem(raw) {
  const lines = raw.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n").split("\n");
  let title = "";
  let date = null;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const match = /^(title|date)\s*[:：]\s*(.*)$/u.exec(line);
    if (!match) break;
    const key = match[1];
    const value = match[2].trim();
    if (key === "title") title = value;
    if (key === "date") date = value || null;
    index += 1;
  }
  const body = lines
    .slice(index)
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .trim();
  return { title, date, body };
}

function countOccurrences(haystack, cue) {
  if (/^[a-z][a-z ]*$/u.test(cue)) {
    const pattern = new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "gu");
    return (haystack.match(pattern) ?? []).length;
  }
  let count = 0;
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(cue, from);
    if (found === -1) return count;
    count += 1;
    from = found + cue.length;
  }
}

function moodCuesFor(searchText, lexicon) {
  const matched = [];
  for (const cues of Object.values(lexicon.categories)) {
    for (const cue of cues) {
      if (cue.length < 2) continue;
      if (countOccurrences(searchText, cue) > 0) matched.push(cue);
    }
  }
  return [...new Set(matched)].sort();
}

function stableOrderKey(record) {
  return sha256([record.author, record.title, record.source.path].join("\u0000"));
}

async function loadLexicon() {
  const value = JSON.parse(await readFile(LEXICON_FILE, "utf8"));
  if (!value || typeof value !== "object" || !value.categories) {
    throw new Error(`Invalid mood lexicon at ${LEXICON_FILE}.`);
  }
  return value;
}

function buildRecord({ author, title, date, body, sourcePath, lexicon }) {
  const text = body;
  const searchText = text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
  if (!author.trim() || !title.trim() || !text.trim() || !searchText) return null;
  return {
    schema_version: SCHEMA_VERSION,
    id: `modern-poem-${sha256([author, title, searchText].join("\u0000")).slice(0, 16)}`,
    title: title.trim(),
    author: author.trim(),
    date,
    text,
    search_text: searchText,
    matched_mood_cues: moodCuesFor(searchText, lexicon),
    source: {
      repository: REPOSITORY,
      commit: PINNED_COMMIT,
      path: sourcePath,
    },
  };
}

function selectForPoet({ candidates, anchors, limit }) {
  const selected = [];
  const used = new Set();
  const missingAnchors = [];
  const byTitle = new Map();
  for (const candidate of candidates) {
    const key = normalizeTitleKey(candidate.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(candidate);
  }
  for (const anchor of anchors) {
    const matches = (byTitle.get(normalizeTitleKey(anchor)) ?? [])
      .filter((candidate) => !used.has(candidate.id))
      .sort((left, right) => left.source.path.localeCompare(right.source.path));
    const record = matches[0];
    if (!record) {
      missingAnchors.push(anchor);
      continue;
    }
    selected.push(record);
    used.add(record.id);
  }
  const rest = candidates
    .filter((candidate) => !used.has(candidate.id))
    .sort((left, right) => stableOrderKey(left).localeCompare(stableOrderKey(right)));
  for (const record of rest) {
    if (selected.length >= limit) break;
    selected.push(record);
    used.add(record.id);
  }
  return { selected, missingAnchors };
}

async function main() {
  const lexicon = await loadLexicon();
  const repository = await resolveSource();

  const tree = git(repository, ["ls-tree", "-r", "--name-only", PINNED_COMMIT, "--", "data"])
    .split("\n")
    .filter((value) => value && value.endsWith(".pt"));

  const filesByPoet = new Map();
  for (const file of tree) {
    const directory = path.posix.basename(path.posix.dirname(file));
    const author = directory.split("_")[0];
    if (!filesByPoet.has(author)) filesByPoet.set(author, []);
    filesByPoet.get(author).push(file);
  }

  const tiers = [
    { poets: CORE_POETS, limit: CORE_LIMIT },
    { poets: DIVERSITY_POETS, limit: DIVERSITY_LIMIT },
  ];

  const candidatesByPoet = new Map();
  let raw = 0;
  let rejected = 0;
  let duplicates = 0;

  for (const tier of tiers) {
    for (const poet of tier.poets) {
      const files = (filesByPoet.get(poet) ?? []).sort((left, right) => left.localeCompare(right));
      if (!files.length) {
        log(`Warning: no upstream directory for ${poet}.`);
        candidatesByPoet.set(poet, []);
        continue;
      }
      const contents = await readPoems(repository, files);
      const seenContent = new Set();
      const candidates = [];
      for (const file of files) {
        raw += 1;
        const parsed = parsePoem(contents.get(file) ?? "");
        const record = buildRecord({
          author: poet,
          title: parsed.title,
          date: parsed.date,
          body: parsed.body,
          sourcePath: file,
          lexicon,
        });
        if (!record) {
          rejected += 1;
          continue;
        }
        if (seenContent.has(record.search_text)) {
          duplicates += 1;
          continue;
        }
        seenContent.add(record.search_text);
        candidates.push(record);
      }
      candidatesByPoet.set(poet, candidates);
      log(`${poet}: ${candidates.length} candidate poems.`);
    }
  }

  const requestedAnchors = [];
  const foundAnchors = [];
  const missingAnchors = [];
  const selected = [];
  const selectedIds = new Set();
  const selectedContent = new Set();

  const keep = (record) => {
    if (selectedIds.has(record.id) || selectedContent.has(record.search_text)) {
      duplicates += 1;
      return false;
    }
    selectedIds.add(record.id);
    selectedContent.add(record.search_text);
    selected.push(record);
    return true;
  };

  for (const tier of tiers) {
    for (const poet of tier.poets) {
      const anchors = ANCHOR_WORKS[poet] ?? [];
      for (const anchor of anchors) requestedAnchors.push({ poet, title: anchor });
      const { selected: picks, missingAnchors: missing } = selectForPoet({
        candidates: candidatesByPoet.get(poet) ?? [],
        anchors,
        limit: tier.limit,
      });
      for (const anchor of anchors) {
        if (missing.includes(anchor)) {
          missingAnchors.push({ poet, title: anchor });
        } else {
          foundAnchors.push({ poet, title: anchor });
        }
      }
      for (const record of picks) keep(record);
    }
  }

  // Top up to the pre-cleaning target from poems the per-poet caps left out.
  const leftover = (tier) => tier.poets.flatMap((poet) =>
    (candidatesByPoet.get(poet) ?? [])
      .filter((record) => !selectedIds.has(record.id) && !selectedContent.has(record.search_text))
      .sort((left, right) => stableOrderKey(left).localeCompare(stableOrderKey(right))));
  for (const tier of tiers) {
    if (selected.length >= TARGET_RECORDS) break;
    for (const record of leftover(tier)) {
      if (selected.length >= TARGET_RECORDS) break;
      keep(record);
    }
  }

  const records = selected.sort((left, right) => left.id.localeCompare(right.id));
  if (records.length < MINIMUM_RECORDS) {
    throw new Error(
      `Only ${records.length} valid poems remain; the corpus requires at least ${MINIMUM_RECORDS}.`,
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonl = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  await writeFile(path.join(OUTPUT_DIR, NORMALIZED_FILE), jsonl, "utf8");

  const perAuthor = {};
  const cueCoverage = {};
  for (const record of records) {
    perAuthor[record.author] = (perAuthor[record.author] ?? 0) + 1;
    for (const cue of record.matched_mood_cues) {
      cueCoverage[cue] = (cueCoverage[cue] ?? 0) + 1;
    }
  }
  const sortedAuthors = Object.fromEntries(
    Object.entries(perAuthor).sort(([left], [right]) => left.localeCompare(right)),
  );
  const sortedCoverage = Object.fromEntries(
    Object.entries(cueCoverage).sort(([left], [right]) => left.localeCompare(right)),
  );

  const manifest = {
    schema_version: SCHEMA_VERSION,
    importer_version: IMPORTER_VERSION,
    generated_at: new Date().toISOString(),
    source: {
      repository: REPOSITORY,
      commit: PINNED_COMMIT,
      url: `https://github.com/${REPOSITORY}`,
      license_note:
        "Copyright remains with the original authors; local non-commercial course research use only.",
    },
    counts: {
      raw,
      selected_before_cleaning: selected.length,
      accepted: records.length,
      duplicates_removed: duplicates,
      rejected,
    },
    authors: sortedAuthors,
    corpus_count: records.length,
    minimum_required: MINIMUM_RECORDS,
    meets_minimum: records.length >= MINIMUM_RECORDS,
    anchors: {
      requested: requestedAnchors,
      found: foundAnchors,
      missing: missingAnchors,
    },
    mood_lexicon: {
      version: lexicon.version ?? "unversioned",
      cue_coverage: sortedCoverage,
    },
    checksum: {
      algorithm: "sha256",
      file: NORMALIZED_FILE,
      value: sha256(jsonl),
    },
  };
  await writeFile(
    path.join(OUTPUT_DIR, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  log(
    `Wrote ${records.length} poems from ${Object.keys(sortedAuthors).length} authors `
    + `(${missingAnchors.length} anchor works missing) to ${OUTPUT_DIR}.`,
  );
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
