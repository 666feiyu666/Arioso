"""Build a blinded listening sheet from the evaluation audio.

Each scenario contributes one baseline audio and five typed Arioso audios. This
script copies them into `eval/blind/audio/` under neutral IDs, shuffles the
order per scenario with a fixed seed, and writes:

  eval/blind/inventory.json       listener-facing list (no condition or type)
  eval/blind/key.json             concealed mapping (researchers only)
  eval/blind/ratings-template.csv one row per (listener, audio)

Run from the repository root:
  python eval/make-blind-sheet.py
"""

import csv
import json
import os
import random
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL = os.path.join(ROOT, "eval")
BLIND = os.path.join(EVAL, "blind")
AUDIO = os.path.join(BLIND, "audio")

SEED = 20261026
LISTENERS = [f"P{i:02d}" for i in range(1, 13)]
TYPES = ["jazz", "blues", "electronic", "instrumental-rock", "instrumental-hip-hop"]


def main() -> None:
    os.makedirs(AUDIO, exist_ok=True)
    scenarios = json.load(open(os.path.join(EVAL, "scenarios.json"), encoding="utf-8"))["scenarios"]

    inventory = {
        "protocol": "docs/DH6012-Documentation/DH6012_Eval.md",
        "note": "Condition and music type are concealed. Do not open key.json while listening.",
        "scenarios": [],
    }
    key = {"seed": SEED, "note": "Researchers only. Maps neutral audio IDs to condition and music type.", "mapping": {}}
    rows = []

    for scenario in scenarios:
        sid = scenario["id"]
        run = json.load(open(os.path.join(EVAL, f"runs/scenario-{sid}/run.json"), encoding="utf-8"))
        typed = json.load(open(os.path.join(EVAL, f"runs/scenario-{sid}/run-types.json"), encoding="utf-8"))["typed"]

        baseline = run["conditions"]["baseline"]
        entries = [("baseline", None, baseline["audioFile"], baseline["durationSeconds"], baseline["sha256"])]
        for music_type in TYPES:
            result = typed[music_type]
            entries.append((
                f"arioso-{music_type}", music_type, result["audioFile"],
                result["durationSeconds"], result["sha256"],
            ))

        order = list(range(len(entries)))
        random.Random(f"{SEED}-{sid}").shuffle(order)
        entries = [entries[index] for index in order]

        audio_list = []
        for position, (condition, music_type, source_file, duration, digest) in enumerate(entries, start=1):
            audio_id = f"S{sid}-{position}"
            source = os.path.join(ROOT, source_file.replace("\\", "/"))
            shutil.copyfile(source, os.path.join(AUDIO, f"{audio_id}.mp3"))
            audio_list.append({"audio_id": audio_id, "file": f"blind/audio/{audio_id}.mp3", "presentation_order": position})
            key["mapping"][audio_id] = {
                "scenario": sid,
                "condition": condition,
                "music_type": music_type,
                "source_file": source_file,
                "durationSeconds": duration,
                "sha256": digest,
            }
            for listener in LISTENERS:
                rows.append({
                    "listener_id": listener,
                    "scenario_id": sid,
                    "audio_id": audio_id,
                    "presentation_order": position,
                    "emotional_fit_1to5": "",
                    "need_fulfilment_1to5": "",
                    "retention_choice": "",
                    "reason": "",
                })

        inventory["scenarios"].append({
            "scenario_id": sid,
            "initial_message": scenario["initialMessage"],
            "underlying_need": scenario["underlyingNeed"],
            "audio": audio_list,
        })

    json.dump(inventory, open(os.path.join(BLIND, "inventory.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(key, open(os.path.join(BLIND, "key.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(os.path.join(BLIND, "ratings-template.csv"), "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "listener_id", "scenario_id", "audio_id", "presentation_order",
            "emotional_fit_1to5", "need_fulfilment_1to5", "retention_choice", "reason",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"audio files: {len(key['mapping'])}")
    print(f"rating rows: {len(rows)} ({len(LISTENERS)} listeners)")
    print(f"written: {os.path.relpath(BLIND, ROOT)}/")


if __name__ == "__main__":
    main()
