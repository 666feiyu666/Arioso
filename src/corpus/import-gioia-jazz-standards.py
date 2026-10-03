"""Extract one source document per tune from Gioia's 2012 PDF in Zotero.

Requires pypdf and pdfplumber. The PDF is read in place, never copied.
"""

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


def clean_lines(lines, compounds=None):
    # Undo typographic ligatures and line wrapping; do not paraphrase source prose.
    text = "\n".join(unicodedata.normalize("NFKC", line) for line in lines)
    compounds = compounds or set()
    text = re.sub(r"([A-Za-z]+)[-\u00ad]\n([a-z][A-Za-z]*)",
                  lambda match: match[1] + ("-" if f"{match[1]}-{match[2]}".lower() in compounds else "") + match[2], text)
    return re.sub(r"\s+", " ", text).strip()


def title_key(title):
    return "".join(c for c in unicodedata.normalize("NFKD", title).casefold() if c.isalnum())


def text_lines(page):
    # This PDF places artificial space glyphs inside some ligatures/italic letters.
    # Remove only spaces geometrically contained in an adjacent printed glyph.
    chars = page.chars
    dropped = set()
    for index, char in enumerate(chars):
        if not char["text"].isspace():
            continue
        neighbors = chars[max(0, index - 1):index] + chars[index + 1:index + 2]
        if any(not neighbor["text"].isspace()
               and abs(char["top"] - neighbor["top"]) < 1
               and char["x0"] >= neighbor["x0"] - 0.05
               and char["x1"] <= neighbor["x1"] + 0.05 for neighbor in neighbors):
            dropped.add(id(char))
    filtered = page.filter(lambda obj: obj["object_type"] != "char"
                           or (obj["size"] > 1 and id(obj) not in dropped))
    return [line for line in filtered.extract_text_lines() if line["top"] >= 50]


def extract_records(pdf_path):
    reader = PdfReader(pdf_path)
    outline = [entry for entry in reader.outline if not isinstance(entry, list)]
    start = next(i for i, entry in enumerate(outline) if entry.title == "After You’ve Gone")
    stop = next(i for i, entry in enumerate(outline) if entry.title == "NOTES")
    tunes = outline[start:stop]
    if len(tunes) != 252 or tunes[-1].title != "You’d Be So Nice to Come Home To":
        raise ValueError("Expected the 252 tune chapters of the 2012 first edition.")
    fingerprint = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    by_page = {}
    for index, tune in enumerate(tunes):
        by_page.setdefault(reader.get_destination_page_number(tune), []).append(index)

    records = [{
        "title": tune.title,
        "record_type": "jazz_standard",
        "chapter_index": index + 1,
        "paragraphs": [],
        "recommended_versions": [],
        "composer_credit": None,
        "source": {
            "type": "book",
            "title": "The Jazz Standards: A Guide to the Repertoire",
            "author": "Ted Gioia",
            "publication_year": 2012,
            "edition": "first",
            "zotero_item_key": "Y5A78C4X",
            "zotero_attachment_key": "TD86TZ3G",
            "pdf_sha256": fingerprint,
            "article_url": None,
            "license": {"name": "All rights reserved", "redistribution_allowed": False},
            "pages": {"pdf_start": None, "pdf_end": None, "printed_start": None, "printed_end": None},
        },
    } for index, tune in enumerate(tunes)]
    active = None
    section = "prose"
    headings_found = []
    inline_compounds = set()
    text_blocks = []
    first_page = reader.get_destination_page_number(tunes[0])
    last_page = reader.get_destination_page_number(outline[stop])
    with pdfplumber.open(pdf_path) as pdf:
        for page_index in range(first_page, last_page):
            page = pdf.pages[page_index]
            lines = text_lines(page)
            for line in lines:
                inline_compounds.update(word.lower() for word in
                                        re.findall(r"\b[A-Za-z]+(?:-[A-Za-z]+)+\b", line["text"]))
            # Find actual title typography, rather than imprecise bookmark coordinates.
            heading_groups = []
            for line_index, line in enumerate(lines):
                if any("TradeGothic" in char["fontname"] and "Bold" in char["fontname"]
                       and 12 <= char["size"] <= 14 for char in line["chars"]):
                    if heading_groups and line_index == heading_groups[-1][-1] + 1:
                        heading_groups[-1].append(line_index)
                    else:
                        heading_groups.append([line_index])
            page_headings = {}
            expected = by_page.get(page_index, [])
            if len(heading_groups) != len(expected):
                raise ValueError(f"PDF page {page_index + 1}: heading count differs from bookmarks.")
            for group, tune_index in zip(heading_groups, expected):
                heading = clean_lines([lines[i]["text"] for i in group])
                if title_key(heading) != title_key(tunes[tune_index].title):
                    raise ValueError(f"PDF page {page_index + 1}: {heading!r} != {tunes[tune_index].title!r}")
                page_headings[group[0]] = (tune_index, set(group))
                headings_found.append(tune_index)
            buffer = []

            def flush():
                if active is None or not buffer:
                    buffer.clear()
                    return
                original_lines = buffer.copy()
                text = clean_lines(buffer)
                buffer.clear()
                if not text or text == "This page intentionally left blank":
                    return
                record = records[active]
                pages = record["source"]["pages"]
                if pages["pdf_start"] is None:
                    pages["pdf_start"] = page_index + 1
                    pages["printed_start"] = reader.page_labels[page_index]
                pages["pdf_end"] = page_index + 1
                pages["printed_end"] = reader.page_labels[page_index]
                if section == "recordings":
                    block = {"text": text, "pdf_page": page_index + 1,
                             "printed_page": reader.page_labels[page_index]}
                    record["recommended_versions"].append(block)
                else:
                    block = {"text": text, "section": "Tune discussion",
                             "pdf_page": page_index + 1,
                             "printed_page": reader.page_labels[page_index]}
                    record["paragraphs"].append(block)
                text_blocks.append((block, original_lines))

            skip = set()
            for line_index, line in enumerate(lines):
                if line_index in skip:
                    continue
                if line_index in page_headings:
                    flush()
                    active, skip_heading = page_headings[line_index]
                    skip.update(skip_heading)
                    section = "prose"
                    continue
                text = unicodedata.normalize("NFKC", line["text"]).strip()
                if title_key(text) == "recommendedversions":
                    flush()
                    section = "recordings"
                    continue
                if active is not None and section == "prose" and text.startswith("Composed by"):
                    records[active]["composer_credit"] = text
                    continue
                # Initial letters marking alphabet sections are decorative, not prose.
                if len(text) == 1 and any(char["size"] > 25 for char in line["chars"]):
                    continue
                buffer.append(text)
            flush()
            page.close()
    if headings_found != list(range(252)):
        raise ValueError("Not all tune headings were found exactly once and in order.")
    for block, original_lines in text_blocks:
        block["text"] = clean_lines(original_lines, inline_compounds)
    for record in records:
        record["text"] = "\n\n".join(paragraph["text"] for paragraph in record["paragraphs"])
        if len(record["text"].split()) < 80:
            raise ValueError(f"Unexpectedly short chapter: {record['title']}")
        pages = record["source"]["pages"]
        record["source"]["citation"] = (
            f"Ted Gioia, The Jazz Standards: A Guide to the Repertoire (2012), "
            f"{record['title']}, pp. {pages['printed_start']}-{pages['printed_end']}."
        )
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True, help="Path to the Zotero 2012 first-edition PDF")
    parser.add_argument("--out", type=Path, default=Path("corpus/jazz/gioia_2012.raw.jsonl"))
    args = parser.parse_args()
    records = extract_records(args.pdf)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")
    print(f"Extracted {len(records)} complete tune discussions to {args.out}")


if __name__ == "__main__":
    main()
