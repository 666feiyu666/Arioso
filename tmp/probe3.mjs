const UA = "AriosoMusicCorpus/0.1 (academic research corpus builder)";
let next = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (params) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(Math.max(0, next - Date.now()));
    next = Date.now() + 1500;
    const url = new URL("https://en.wikipedia.org/w/api.php");
    for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) url.searchParams.set(k, v);
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    if (r.ok && text.startsWith("{")) return JSON.parse(text);
    if (attempt === 4) throw new Error(`${r.status}: ${text.slice(0, 120)}`);
    next = Date.now() + 5000 * (attempt + 1);
  }
};

const blues = await api({ action: "parse", page: "List of blues genres", prop: "text", redirects: "1" });
const html = blues.parse.text;
const bh = [...html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/\[edit\]/gi, "").trim());
console.log("BLUES headings:", JSON.stringify(bh));
const blis = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/\s+/g, " "));
console.log("BLUES li total:", blis.length);
console.log("BLUES li sample:", blis.slice(0, 12).map((h) => h.slice(0, 150)));

const bs = await api({ action: "parse", page: "List of blues standards", prop: "text", redirects: "1" });
const bsHtml = bs.parse.text;
const bsLis = [...bsHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/\s+/g, " ")).filter((h) => !/href="#/.test(h));
console.log("\nBLUES STANDARDS li(non-TOC):", bsLis.length);
console.log(bsLis.slice(0, 6).map((h) => h.slice(0, 300)));
const bsTable = bsHtml.match(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? "";
console.log("BS table rows:", bsTable.split("</tr>").length - 1, "head:", bsTable.slice(0, 300).replace(/\s+/g, " "));

const ri = await api({ action: "parse", page: "List of rock instrumentals", prop: "text", redirects: "1" });
const riHtml = ri.parse.text;
const table = riHtml.match(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? "";
const rows = table.split("</tr>").slice(1, 4).map((r) => [...r.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
console.log("\nROCK table sample rows:", JSON.stringify(rows));
const riLis = [...riHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/\s+/g, " ")).filter((h) => !/href="#/.test(h));
console.log("ROCK li(non-TOC):", riLis.length, riLis.slice(0, 3).map((h) => h.slice(0, 200)));

for (const cat of ["Category:Instrumental hip-hop albums", "Category:Instrumental rock albums", "Category:Instrumental rock", "Category:Ambient albums", "Category:Post-rock albums", "Category:Lo-fi hip hop albums", "Category:Electronic music genres", "Category:Instrumental hip-hop"]) {
  const c = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmlimit: "500" });
  const members = c.query?.categorymembers ?? [];
  const pages = members.filter((m) => m.ns === 0);
  const cats = members.filter((m) => m.ns === 14);
  console.log(`CAT ${cat}: members=${members.length} pages=${pages.length} subcats=${cats.length} e.g. ${pages.slice(0, 3).map((m) => m.title).join(" | ")} ${cats.length ? "subcats: " + cats.slice(0, 5).map((m) => m.title).join(", ") : ""}`);
}
