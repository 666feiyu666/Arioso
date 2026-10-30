import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/export-archify-svg.mjs <input.html> <output.svg>");
}

const html = await readFile(inputPath, "utf8");
const svgMatch = html.match(/<svg(?=\s+viewBox=)[\s\S]*?<\/svg>/u);
if (!svgMatch) throw new Error(`No diagram SVG found in ${inputPath}`);

const css = `
svg { font-family: "Segoe UI", Arial, sans-serif; }
.c-grid { stroke: #e2e8f0; fill: none; }
.c-mask { fill: #ffffff; stroke: none; }
.c-frontend { fill: #cffafe; stroke: #0891b2; }
.c-backend { fill: #d1fae5; stroke: #059669; }
.c-database { fill: #ede9fe; stroke: #7c3aed; }
.c-cloud { fill: #fef3c7; stroke: #d97706; }
.c-security { fill: #ffe4e6; stroke: #e11d48; }
.c-messagebus { fill: #ffedd5; stroke: #ea580c; }
.c-external { fill: #e2e8f0; stroke: #64748b; }
.c-region { fill: #fffbeb; stroke: #d97706; stroke-dasharray: 8,4; }
.c-security-group { fill: none; stroke: #e11d48; stroke-dasharray: 4,4; }
.c-lane { fill: #f8fafc; stroke: #cbd5e1; stroke-dasharray: 6,6; }
.t-primary { fill: #0f172a; }
.t-muted { fill: #475569; }
.t-dim { fill: #64748b; }
.t-frontend { fill: #0891b2; }
.t-backend { fill: #059669; }
.t-database { fill: #7c3aed; }
.t-cloud { fill: #d97706; }
.t-security { fill: #e11d48; }
.t-messagebus { fill: #ea580c; }
.t-external { fill: #64748b; }
.a-default { stroke: #64748b; fill: none; }
.a-emphasis { stroke: #059669; fill: none; }
.a-security { stroke: #e11d48; fill: none; stroke-dasharray: 5,5; }
.a-dashed { stroke: #7c3aed; fill: none; stroke-dasharray: 4,4; }
.m-default { fill: #64748b; }
.m-emphasis { fill: #059669; }
.m-security { fill: #e11d48; }
.m-dashed { fill: #7c3aed; }
.semantic-sigil { fill: none; stroke: currentColor; stroke-width: 1.35; stroke-linecap: round; stroke-linejoin: round; opacity: 0.76; }
.semantic-sigil > * { vector-effect: non-scaling-stroke; }
.semantic-sigil .sigil-fill { fill: currentColor; stroke: none; }
.s-frontend { color: #0891b2; }
.s-backend { color: #059669; }
.s-database { color: #7c3aed; }
.s-cloud { color: #d97706; }
.s-security { color: #e11d48; }
.s-messagebus { color: #ea580c; }
.s-external { color: #64748b; }
`;

const svg = svgMatch[0]
  .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" data-theme="light" ')
  .replace(
    /(<desc[^>]*>[\s\S]*?<\/desc>)/u,
    `$1\n<style><![CDATA[${css}]]></style>\n<rect width="100%" height="100%" fill="#ffffff"/>`,
  );

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, "utf8");
