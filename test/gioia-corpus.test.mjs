import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { combineRecords, titleKey } from "../src/corpus/combine-jazz-standards.mjs";
import { normalizeBookRecord } from "../src/corpus/normalize-gioia-jazz-standards.mjs";
import { createJazzRetriever, loadJazzRetriever } from "../src/retrieval/jazz-retriever.ts";

describe("book source normalization", () => {
  it("keeps a sentence spanning PDF pages and excludes the recording list", () => {
    const raw = {
      title: "Example",
      paragraphs: [
        { text: "A 6/8 blues uses a repeated", pdf_page: 20, printed_page: "3" },
        { text: "piano vamp and sparse horn phrasing.", pdf_page: 21, printed_page: "4" },
      ],
      recommended_versions: [{ text: "A famous trumpeter, 1959.", pdf_page: 21 }],
      source: { article_url: null, type: "book", author: "Ted Gioia" },
    };
    const normalized = normalizeBookRecord(raw, new Map([[titleKey(raw.title), { id: "wiki-example" }]]));
    expect(normalized.work_id).toBe("wiki-example");
    expect(normalized.musical_evidence).toEqual([{
      source: "book_chapter", section: "Tune discussion",
      text: "A 6/8 blues uses a repeated piano vamp and sparse horn phrasing.",
      pdf_page_start: 20, pdf_page_end: 21, printed_page_start: "3", printed_page_end: "4",
    }]);
    expect(normalized.musical_description).not.toContain("1959");
  });

  it("retains an evidence gap rather than filling it with invented analysis", () => {
    const normalized = normalizeBookRecord({
      title: "Example", source: { article_url: null },
      paragraphs: [{ text: "It was released in 1959 and became famous.", pdf_page: 20, printed_page: "3" }],
    });
    expect(normalized.normalization_status).toBe("insufficient_musical_evidence");
    expect(normalized.musical_description).toBe("");
  });
});

describe("multi-source corpus", () => {
  it("counts two source texts about the same tune separately", () => {
    const common = { title: "All Blues", normalization_status: "complete", musical_description: "A 6/8 blues." };
    const { records, counts } = combineRecords([{ ...common, id: "wiki-all-blues" }], [{ ...common, id: "gioia-2012-all-blues" }]);
    expect(records).toHaveLength(2);
    expect(counts.record_count).toBe(2);
    expect(counts.distinct_title_count).toBe(1);
    expect(counts.same_title_as_wikipedia_count).toBe(1);
    expect(() => combineRecords(records, records)).toThrow("IDs must be unique");
  });

  it("ships every book chapter and more than 500 searchable source texts", async () => {
    const parse = (text) => text.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    const [raw, book, combined] = await Promise.all([
      "gioia_2012.raw.jsonl", "gioia_2012.normalized.jsonl", "jazz_standards.combined.normalized.jsonl",
    ].map(async (file) => parse(await readFile(new URL(`../corpus/jazz/${file}`, import.meta.url), "utf8"))));
    expect(raw).toHaveLength(252);
    expect(book).toHaveLength(252);
    expect(combined).toHaveLength(606);
    expect(new Set(combined.map((record) => record.id)).size).toBe(606);
    expect(combined.filter((record) => record.normalization_status === "complete" && record.musical_description)).toHaveLength(520);
    expect(raw[0].title).toBe("After You’ve Gone");
    expect(raw.at(-1).title).toBe("You’d Be So Nice to Come Home To");
    expect(raw.find((record) => record.title === "All Blues").text).toContain("modified blues structure");
    expect(raw.every((record) => record.text.split(/\s+/).length > 80 && record.source.pages.pdf_start <= record.source.pages.pdf_end)).toBe(true);
    for (const record of book) {
      expect(record.source.license.redistribution_allowed).toBe(false);
      for (const excerpt of record.musical_evidence) {
        expect(excerpt.pdf_page_start).toBeGreaterThanOrEqual(record.source.pages.pdf_start);
        expect(excerpt.pdf_page_end).toBeLessThanOrEqual(record.source.pages.pdf_end);
      }
    }
    const result = createJazzRetriever(book).search("distinctive piano vamp turnaround", 5).find((reference) => reference.title === "All Blues");
    expect(result?.articleUrl).toBeNull();
    expect(result?.source.citation).toContain("2012");
    expect(result?.source.pages.printed_start).toBe("11");
  });

  it("loads the combined corpus by default with book provenance", async () => {
    const references = (await loadJazzRetriever()).search("hoary vamp underplay", 3);
    expect(references.some((reference) => reference.id === "gioia-2012-all-blues" && reference.source.author === "Ted Gioia")).toBe(true);
  });
});
