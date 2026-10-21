const UA = "AriosoMusicCorpus/0.1 (academic research corpus builder)";
const api = async (params) => {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  return r.json();
};

// 1) blues genres: find wikitables with genre columns
const blues = await api({ action: "parse", page: "List of blues genres", prop: "text", redirects: "1" });
for (const [i, t] of [...blues.parse.text.matchAll(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi)].entries()) {
  const headers = [...t[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ").trim()).slice(0, 8);
  console.log(`BLUES table ${i} len=${t[0].length} headers=${JSON.stringify(headers)}`);
  console.log("  first row:", t[0].split("</tr>")[1]?.slice(0, 400).replace(/\s+/g, " "));
}

// 2) blues standards list items
const bs = await api({ action: "parse", page: "List of blues standards", prop: "text", redirects: "1" });
const bsLis = [...bs.parse.text.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/\s+/g, " ")).filter((h) => /"|“/.test(h));
console.log(`\nBLUES STANDARDS li with quotes: ${bsLis.length}`);
console.log("  sample:", bsLis.slice(0, 3).map((h) => h.slice(0, 200)));

// 3) electronic genres structure
const el = await api({ action: "parse", page: "List of electronic music genres", prop: "text", redirects: "1" });
const headings = [...el.parse.text.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/\[edit\]/gi, "").trim());
console.log(`\nELECTRONIC headings(${headings.length}):`, JSON.stringify(headings.slice(0, 40)));
const elLis = [...el.parse.text.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]).filter((h) => /href="\/wiki\//.test(h));
console.log("  li with wiki links:", elLis.length, "sample:", elLis.slice(0, 2).map((h) => h.slice(0, 160).replace(/\s+/g, " ")));

// 4) rock instrumentals
const ri = await api({ action: "parse", page: "List of rock instrumentals", prop: "text", redirects: "1" });
const riLis = [...ri.parse.text.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/\s+/g, " ")).filter((h) => /href="\/wiki\//.test(h));
console.log(`\nROCK INSTRUMENTALS li(${riLis.length}) sample:`, riLis.slice(0, 4).map((h) => h.slice(0, 180)));
const riTables = [...ri.parse.text.matchAll(/<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi)];
for (const [i, t] of riTables.entries()) {
  const rows = t[0].split("</tr>").length - 1;
  console.log(`  ROCK table ${i} rows=${rows} head=`, t[0].slice(0, 260).replace(/\s+/g, " "));
}

// 5) category sizes
for (const cat of ["Category:Instrumental hip-hop albums", "Category:Instrumental rock albums", "Category:Ambient albums", "Category:Electronic music albums", "Category:Instrumental hip-hop", "Category:Instrumental rock", "Category:Post-rock albums", "Category:Lo-fi hip hop albums", "Category:Electronic albums by genre"]) {
  const c = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmlimit: "10" });
  console.log(`\nCAT ${cat}: ${c.query?.categorymembers?.length ?? 0} sample=${(c.query?.categorymembers ?? []).slice(0, 4).map((m) => m.title).join(" | ")} err=${c.error?.code ?? ""}`);
}
