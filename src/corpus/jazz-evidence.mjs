// Keep source wording and musical notation while removing HTML presentation.
export function decodeHtml(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"', ndash: "–", mdash: "—", flat: "♭", sharp: "♯" };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

export function readableText(html) {
  return decodeHtml(html
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>\s*<br\s*\/?>\s*<sub\b[^>]*>([\s\S]*?)<\/sub>/gi,
      (_, top, bottom) => `${top.replace(/<[^>]+>/g, "").trim()}/${bottom.replace(/<[^>]+>/g, "").trim()}`)
    .replace(/<sup\b[^>]*(?:reference|cite_ref)[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim());
}

export function articleParagraphs(html) {
  const headings = [];
  const paragraphs = [];
  // Exclude quotations, lyrics, reference lists, and non-prose UI elements.
  const prose = html.replace(/<(style|script|blockquote|table)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const blocks = /<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>|<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  for (const block of prose.matchAll(blocks)) {
    if (block[1]) {
      const level = Number(block[1]) - 2;
      headings.length = level;
      headings[level] = readableText(block[2]).replace(/\[edit\]/gi, "").trim();
      continue;
    }
    const section = headings.filter(Boolean).join(" / ") || "Lead";
    if (/references|bibliography|external links|further reading|see also|lyrics|lyrical/i.test(section)) continue;
    const text = readableText(block[3]);
    if (text) paragraphs.push({ section, text });
  }
  return paragraphs;
}

export function splitSentences(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim()
    .replace(/\b(?:[A-Z]\.\s*){2,}(?=[A-Z][a-z])/g, (initials) => initials.replaceAll(".", "<period>"))
    .replace(/\b(St|Mr|Mrs|Ms|Dr|Jr|Sr)\./g, "$1<period>")
    .split(/(?<=[.!?])\s+(?=["“']?[A-Z0-9])/)
    .map((sentence) => sentence.replaceAll("<period>", ".").trim()).filter(Boolean);
}

const MUSICAL_FEATURES = {
  harmony: /\b(?:chords?|progression|harmon(?:y|ic|ies)|tonal(?:ity)?|atonal|mixolydian|dorian|lydian|phrygian|pentatonic|chromatic|diatonic|modulat\w*|reharmon\w*|voicings?|dominant|diminished|augmented|sevenths?|ninths?|thirteenths?)\b|\b(?:major|minor)(?: and (?:major|minor))? (?:keys?|modes?|scales?|chords?|blues)\b|\bkey of\b|(?:ii|II)[–-](?:V)[–-](?:I|i)/i,
  rhythm: /\b(?:rhythm\w*|groove|syncopat\w*|tempo|bpm|meter|time signature|bars?|measures?|waltz|polyrhythm\w*|clave|ostinato|shuffle|offbeat|backbeat)\b|\b\d+\/\d+\b|\b(?:slow|fast|medium|up)[- ]tempo\b|\b(?:slow|fast|erratic)(?:\s+\w+){0,3}\s+(?:jazz|rhythms?|tempos?|music)\b/i,
  melody: /\b(?:melod(?:y|ic)|motif|riff|theme|phrasing|intervals?|counterpoint|call.and.response)\b/i,
  form: /\b(?:chorus|choruses|verse|bridge|refrain|AABA|ABAC|ABAB|ABA|twelve[- ]bar|12[- ]bar|32[- ]bar)\b/i,
  instrumentation: /\b(?:piano|organ|guitar|bass|drums?|percussion|saxophone|sax|trumpet|trombone|clarinet|violin|vibraphone|flute|horns?|brushes|ride cymbal|ensemble|orchestra|band|duo|trio|quartet|quintet|sextet|octet|rhythm section)\b/i,
  arrangement: /\b(?:phrasing|timbre|texture|register|comping|accompaniment|improvis(?:e|ed|ation)|solo|unison|arrang(?:e|ed|ement))\b/i,
  style: /\b(?:ragtime|swing|bebop|bop|dixieland|stride|boogie(?:-woogie)?|gospel|spiritual|ballad|bossa nova|samba|calypso|funk|modal|fusion|blues)\b/i,
  mood: /\b(?:somber|mysterious|sinister|melanchol\w*|relaxed|restrained|gentle|intimate|aggressive|energetic|joyful|solemn|dark)\b[^.!?]{0,65}\b(?:tone|mood|atmosphere|texture|sound)\b/i,
};
const HISTORY = /\b(?:copyright\w*|publish\w*|written by|composed by|composition by|credited|pseudonym|record(?:ing|ed)|released|debuted|charts?|sales|sold|award|grammy|popular\w*|famous|influential|born|died|death|manager|film|movie|television|broadway)\b/i;
// Pitch letters remain case-sensitive so the article "a" cannot become key A.
const NOTE_TONALITY = /\b(?:[Ii]n|[Kk]ey of|[Pp]layed in) [A-G](?:[♭♯#]|-flat|-sharp)?(?: major| minor)?\b/;
const MUSICAL_ACTION = /\b(?:uses?|features?|based|built|consists?|contains?|characterized|combin\w*|mix\w*|blend\w*|plays?|played|accompani\w*|rhythm\w*|melod\w*|harmon\w*|chords?|voic\w*|solo\w*|bass line|piano part|drum pattern|instrumentation)\b/i;

function withoutTitle(sentence, title) {
  if (!title) return sentence;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return sentence.replace(new RegExp(escaped, "gi"), " ");
}

export function musicalFeatures(sentence, title = "") {
  const content = withoutTitle(sentence, title);
  return Object.entries(MUSICAL_FEATURES).filter(([feature, pattern]) => pattern.test(content) || (feature === "harmony" && NOTE_TONALITY.test(content))).map(([feature]) => feature);
}

export function isMusicalEvidence(sentence, title = "") {
  if (/^(?:\d{4}\s*[–—-]\s*)?["“][^"”]+["”][).,\s]*$/.test(sentence.trim())) return false;
  const content = withoutTitle(sentence, title);
  const features = musicalFeatures(sentence, title);
  if (!features.length || !/[a-z]{2}/i.test(content)) return false;
  if (/\b(?:lyrics?|lyrical|words of the song)\b/i.test(content)) return false;
  // Artist credits and recording history are retained only with concrete musical behavior.
  const hasMusicalStructure = features.includes("rhythm") || features.includes("form");
  const hasMusicalDetail = /\b(?:melod(?:y|ic)|chords?|harmon\w*|voicings?|motif|riff|phrasing|comping|timbre|texture|key of|major key|minor key)\b/i.test(content);
  if (HISTORY.test(content) && !hasMusicalDetail && !hasMusicalStructure && !NOTE_TONALITY.test(content)) return false;
  if (features.every((feature) => feature === "instrumentation") && !MUSICAL_ACTION.test(content)) return false;
  if (features.every((feature) => feature === "style") && HISTORY.test(content)) return false;
  return true;
}

export function collectMusicalEvidence(record, article) {
  const evidence = [];
  const add = (text, source, extra = {}) => {
    for (const sentence of splitSentences(text)) {
      if (isMusicalEvidence(sentence, record.title)) evidence.push({ source, text: sentence, ...extra });
    }
  };
  for (const seed of record.seed_evidence ?? []) {
    add(seed.list_description, "seed_description", { revision_url: seed.seed_page_revision_url });
  }
  add(record.article_extract, "article_extract", { revision_url: `${record.article_url}?oldid=${record.article_revision_id}` });
  if (article?.enrichment_status === "complete") {
    for (const paragraph of article.paragraphs) {
      add(paragraph.text, "article_body", { section: paragraph.section, revision_url: article.source.revision_url });
    }
  }
  const seen = new Set();
  return evidence.filter((item) => {
    const key = item.text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function musicalDescription(evidence, title, wordBudget = 300) {
  const candidates = evidence.map((item, index) => {
    const features = musicalFeatures(item.text, title);
    const sectionWeight = /analysis|composit|musical|harmony|rhythm|structure|melody|form/i.test(item.section ?? "") ? 4 : 0;
    const detailWeight = features.filter((feature) => feature !== "style").length * 2;
    return { index, item, features, words: item.text.split(/\s+/).length, score: sectionWeight + detailWeight };
  });
  const selected = [];
  const covered = new Set();
  let words = 0;
  while (candidates.length && selected.length < 12) {
    candidates.sort((a, b) => (b.score + b.features.filter((feature) => !covered.has(feature)).length * 2) -
      (a.score + a.features.filter((feature) => !covered.has(feature)).length * 2) || a.index - b.index);
    const next = candidates.shift();
    if (words + next.words > wordBudget) continue;
    selected.push(next);
    words += next.words;
    for (const feature of next.features) covered.add(feature);
  }
  // An unusually long source sentence remains intact rather than being silently rewritten.
  if (!selected.length && evidence.length) return evidence[0].text;
  return selected.sort((a, b) => a.index - b.index).map((entry) => entry.item.text).join(" ");
}
