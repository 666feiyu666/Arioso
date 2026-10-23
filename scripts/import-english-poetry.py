#!/usr/bin/env python3
"""Build the English-poetry retrieval corpus for MoodMic.

The importer reads the checked-in `sample.csv` of
Wang-Haining/fine-grained-poetry-interpretation and keeps only the
public-domain rows that carry a full poem text. The machine tags (Plutchik
`emotions`, `sentiment`, `themes`, `themes_50`) are mapped onto the shared mood
lexicon and become retrieval cues; they are never an assignment about what the
poem means. Poetry Foundation rows have their poem text masked (null) and are
skipped.

    python scripts/import-english-poetry.py [--source PATH]

Without --source the importer downloads the sample.csv from the pinned GitHub
repository. With --source it reads a local copy instead (e.g. tmp/sample.csv).
"""

import argparse
import csv
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPOSITORY = "Wang-Haining/fine-grained-poetry-interpretation"
REPOSITORY_URL = "https://github.com/" + REPOSITORY
SAMPLE_CSV_URL = "https://raw.githubusercontent.com/" + REPOSITORY + "/main/sample.csv"
SCHEMA_VERSION = "1.0"
IMPORTER_VERSION = "1.0.0"

OUTPUT_DIR = Path("corpus", "poem", "English")
NORMALIZED_FILE = "english_poems.normalized.jsonl"
MANIFEST_FILE = "english_poems.manifest.json"
LEXICON_FILE = Path("corpus", "poem", "mood-lexicon.json")

# Cleaning thresholds: drop stub poems and a handful of concatenated blobs.
MIN_POEM_CHARS = 50
MAX_POEM_CHARS = 20000
MINIMUM_RECORDS = 300


def log(message: str) -> None:
    print(message, file=sys.stderr)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_search_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"\s+", " ", normalized).strip()


def is_ascii_word(value: str) -> bool:
    return bool(re.fullmatch(r"[a-z][a-z ]*", value))


def download_csv() -> Path:
    target = Path(tempfile.gettempdir()) / "arioso-english-poetry-sample.csv"
    if not target.exists():
        log(f"Downloading {SAMPLE_CSV_URL} ...")
        urllib.request.urlretrieve(SAMPLE_CSV_URL, target)
    return target


def load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_cues(row: dict, lexicon: dict) -> list[str]:
    """Map the machine tags onto the shared mood lexicon plus open themes."""
    categories = lexicon["categories"]
    plutchik = lexicon.get("plutchik", {})
    emotion_map = plutchik.get("emotions_to_categories", {})
    sentiment_map = plutchik.get("sentiment_to_categories", {})

    category_names = set()
    for emotion in (row.get("emotions") or "").split(";"):
        category_names.update(emotion_map.get(emotion.strip().lower(), []))
    category_names.update(
        sentiment_map.get((row.get("sentiment") or "").strip().lower(), []),
    )

    cues = set()
    for name in category_names:
        for cue in categories.get(name, []):
            if is_ascii_word(cue):
                cues.add(cue)
    for field in ("themes", "themes_50"):
        for theme in (row.get(field) or "").split(";"):
            theme = theme.strip().lower()
            if len(theme) >= 2:
                cues.add(theme)
    return sorted(cues)


def build_record(row: dict, lexicon: dict) -> dict | None:
    title = (row.get("title") or "").strip()
    author = (row.get("author") or "").strip()
    text = (row.get("poem") or "").strip()
    search_text = normalize_search_text(text)
    if not author or not title or not text or not search_text:
        return None
    return {
        "schema_version": SCHEMA_VERSION,
        "id": "english-poem-" + sha256(author + "\u0000" + title + "\u0000" + search_text)[:16],
        "title": title,
        "author": author,
        "date": None,
        "text": text,
        "search_text": search_text,
        "matched_mood_cues": build_cues(row, lexicon),
        "source": {
            "repository": REPOSITORY,
            "commit": "main",
            "path": "sample.csv",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        help="local sample.csv to read instead of downloading the pinned copy",
    )
    args = parser.parse_args()

    lexicon = json.loads(LEXICON_FILE.read_text(encoding="utf-8"))
    source = Path(args.source).resolve() if args.source else download_csv()
    rows = load_csv(source)

    raw = len(rows)
    rejected = 0
    duplicates = 0
    seen_content = set()
    records = []

    for row in rows:
        if (row.get("source") or "").strip() != "public_domain_poetry":
            rejected += 1
            continue
        record = build_record(row, lexicon)
        if not record:
            rejected += 1
            continue
        length = len(record["text"])
        if length < MIN_POEM_CHARS or length > MAX_POEM_CHARS:
            rejected += 1
            continue
        if record["search_text"] in seen_content:
            duplicates += 1
            continue
        seen_content.add(record["search_text"])
        records.append(record)

    records.sort(key=lambda item: item["id"])
    if len(records) < MINIMUM_RECORDS:
        raise SystemExit(
            f"Only {len(records)} public-domain poems remain; "
            f"the corpus requires at least {MINIMUM_RECORDS}.",
        )

    jsonl = "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # newline="\n" keeps the bytes identical to the in-memory string on
    # Windows, where the default text mode would translate \n to \r\n and
    # break the manifest checksum.
    (OUTPUT_DIR / NORMALIZED_FILE).write_text(jsonl, encoding="utf-8", newline="\n")

    per_author: dict[str, int] = {}
    cue_coverage: dict[str, int] = {}
    for record in records:
        per_author[record["author"]] = per_author.get(record["author"], 0) + 1
        for cue in record["matched_mood_cues"]:
            cue_coverage[cue] = cue_coverage.get(cue, 0) + 1

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "importer_version": IMPORTER_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "repository": REPOSITORY,
            "commit": "main",
            "url": REPOSITORY_URL,
            "license_note": (
                "Poem texts are public domain; interpretations and categorical "
                "tags are MIT (Wang-Haining/fine-grained-poetry-interpretation). "
                "Local non-commercial course research use only."
            ),
        },
        "counts": {
            "raw": raw,
            "rejected": rejected,
            "duplicates_removed": duplicates,
            "accepted": len(records),
        },
        "authors": dict(sorted(per_author.items())),
        "corpus_count": len(records),
        "minimum_required": MINIMUM_RECORDS,
        "meets_minimum": len(records) >= MINIMUM_RECORDS,
        "mood_lexicon": {
            "version": lexicon.get("version", "unversioned"),
            "cue_coverage": dict(sorted(cue_coverage.items())),
        },
        "checksum": {
            "algorithm": "sha256",
            "file": NORMALIZED_FILE,
            "value": sha256(jsonl),
        },
    }
    (OUTPUT_DIR / MANIFEST_FILE).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    log(
        f"Wrote {len(records)} poems from {len(per_author)} authors "
        f"({rejected} rejected, {duplicates} duplicates) to {OUTPUT_DIR}.",
    )


if __name__ == "__main__":
    main()
