import { describe, expect, it } from "vitest";
import { articleParagraphs, collectMusicalEvidence, isMusicalEvidence, musicalDescription, readableText } from "../src/corpus/jazz-evidence.mjs";

describe("Jazz corpus source evidence", () => {
  it("rejects generic standard status and title-only fragments", () => {
    expect(isMusicalEvidence("It has become a jazz standard.", "Footprints")).toBe(false);
    expect(isMusicalEvidence('1959 – " All Blues ".', "All Blues")).toBe(false);
    expect(isMusicalEvidence('"Recado Bossa Nova").', "The Gift!")).toBe(false);
  });

  it("keeps concrete music in a sentence that also contains composer history", () => {
    expect(isMusicalEvidence('"All Blues" is a twelve-bar blues in 6/8 composed by Miles Davis.', "All Blues")).toBe(true);
    expect(isMusicalEvidence('It was recorded by a jazz band with a piano player.')).toBe(false);
  });

  it("retains concise tonality evidence without treating length as quality", () => {
    expect(isMusicalEvidence("It is usually played in G.")).toBe(true);
    expect(isMusicalEvidence("A major development in the history of jazz.")).toBe(false);
    expect(isMusicalEvidence("It became famous in a nightclub.")).toBe(false);
    expect(isMusicalEvidence("A new form of jazz.")).toBe(false);
    expect(isMusicalEvidence("Jazz characterized by a large ensemble.")).toBe(true);
    expect(isMusicalEvidence("Slow or erratic contemporary jazz with a somber, mysterious, or sinister tone influenced by film noir soundtracks and dark ambient music.", "Jazz noir")).toBe(true);
  });

  it("preserves meter fractions, accidentals and source wording", () => {
    expect(readableText('In G, a <sup>6</sup><br/><sub>8</sub> blues uses E♭7.<sup class="reference">[1]</sup>')).toBe("In G, a 6/8 blues uses E♭7.");
    expect(readableText('Cm<sup>7</sup> and D<sup>7♭9</sup><sup class="reference">[2]</sup>')).toBe("Cm 7 and D 7♭9");
  });

  it("extracts musical body sections without lyric or citation contamination", () => {
    const paragraphs = articleParagraphs('<table><p>A piano credit.</p></table><p>A 6/8 blues.</p><h2>Analysis</h2><p>A repeated bass riff.</p><h2>Lyrics</h2><p>A sung refrain.</p><h2>References</h2><h3>Books</h3><p>Jazz harmony bibliography.</p>');
    expect(paragraphs).toEqual([{ section: "Lead", text: "A 6/8 blues." }, { section: "Analysis", text: "A repeated bass riff." }]);
  });

  it("deduplicates intro/body evidence and preserves revision provenance", () => {
    const record = { title: "Example", article_url: "https://en.wikipedia.org/wiki/Example", article_revision_id: 42, article_extract: "A 6/8 blues.", seed_evidence: [] };
    const body = { enrichment_status: "complete", source: { revision_url: "https://en.wikipedia.org/wiki/Example?oldid=42" }, paragraphs: [{ section: "Lead", text: "A 6/8 blues." }, { section: "Analysis", text: "A repeated bass riff." }] };
    const evidence = collectMusicalEvidence(record, body);
    expect(evidence).toHaveLength(2);
    expect(evidence[1]).toEqual({ source: "article_body", section: "Analysis", text: "A repeated bass riff.", revision_url: body.source.revision_url });
  });

  it("prioritizes actionable analysis over style labels within a description budget", () => {
    const evidence = [{ text: "A blues ballad.", section: "Lead" }, { text: "A repeated bass riff in 6/8.", section: "Analysis" }];
    expect(musicalDescription(evidence, "Example", 7)).toBe("A repeated bass riff in 6/8.");
    expect(evidence).toHaveLength(2);
  });
});
