const titles = [
  "List of blues genres",
  "List of blues standards",
  "List of electronic music genres",
  "List of rock instrumentals",
  "List of instrumental rock artists",
  "Instrumental hip-hop",
  "Lo-fi hip hop",
  "Category:Instrumental hip-hop albums",
  "Category:Instrumental rock albums",
  "Category:Ambient albums",
  "Category:Electronic music genres",
];

const UA = "AriosoMusicCorpus/0.1 (academic research corpus builder)";
for (const title of titles) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|revid&format=json&formatversion=2&redirects=1`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
    const j = await r.json();
    const html = j.parse?.text ?? "";
    const lis = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].length;
    const tables = [...html.matchAll(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>/gi)].length;
    const catLinks = (html.match(/Category:/g) ?? []).length;
    console.log(`${title}\n  revid=${j.parse?.revid ?? "-"} html=${html.length} wikitable=${tables} li=${lis} catlinks=${catLinks} err=${j.error?.code ?? ""}`);
    const firstTable = html.match(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0];
    if (firstTable) console.log("  table head:", firstTable.slice(0, 220).replace(/\s+/g, " "));
    const sampleLi = html.match(/<li\b[^>]*>[\s\S]{40,300}?<\/li>/i)?.[0];
    if (sampleLi) console.log("  li sample:", sampleLi.slice(0, 260).replace(/\s+/g, " "));
  } catch (e) {
    console.log(`${title}\n  ERROR ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
