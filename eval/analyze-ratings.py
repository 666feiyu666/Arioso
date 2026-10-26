"""按条件 / 音乐类型汇总盲听评分。

先跑 `python eval/merge-ratings.py`，再运行：
  python eval/analyze-ratings.py

用 eval/blind/key.json（仅研究者）把音频编号映射回 baseline 或 arioso-<type>，
输出各条件的情绪适配均值、需求达成均值，以及各场景的对比。
"""

import csv
import json
import os
import statistics
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLIND = os.path.join(ROOT, "eval", "blind")
RATINGS = os.path.join(BLIND, "ratings-collected.csv")
KEY = os.path.join(BLIND, "key.json")

LABELS = {
    "baseline": "直连基线",
    "jazz": "爵士",
    "blues": "布鲁斯",
    "electronic": "电子",
    "instrumental-rock": "器乐摇滚",
    "instrumental-hip-hop": "器乐嘻哈",
}


def number(value: str | None) -> float | None:
    try:
        return float(value or "")
    except ValueError:
        return None


def main() -> None:
    key = json.load(open(KEY, encoding="utf-8"))["mapping"]
    rows = list(csv.DictReader(open(RATINGS, encoding="utf-8-sig", newline="")))

    by_condition: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    for row in rows:
        mapping = key.get(row.get("音频编号", ""))
        if not mapping:
            continue
        label = "baseline" if mapping["condition"] == "baseline" else mapping["music_type"]
        fit = number(row.get("情绪适配_1到5"))
        need = number(row.get("需求达成_1到5"))
        if fit is None and need is None:
            continue
        by_condition[label].append((fit or 0.0, need or 0.0, mapping["scenario"]))

    def mean(values: list[float]) -> str:
        return f"{statistics.mean(values):.2f}" if values else "-"

    print(f"听众 {len({row.get('听众编号', '') for row in rows})} 位 | 评分 {len(rows)} 条")
    print("\n=== 各条件 / 音乐类型 ===")
    print("条件 | 样本数 | 情绪适配均值 | 需求达成均值")
    for label in sorted(by_condition):
        entries = by_condition[label]
        print(f"{LABELS.get(label, label)} | {len(entries)} | {mean([e[0] for e in entries])} | {mean([e[1] for e in entries])}")

    print("\n=== 各场景的需求达成均值 ===")
    labels = sorted(by_condition)
    scenes = sorted({e[2] for entries in by_condition.values() for e in entries})
    print("场景 | " + " | ".join(LABELS.get(label, label) for label in labels))
    for scene in scenes:
        cells = []
        for label in labels:
            values = [e[1] for e in by_condition[label] if e[2] == scene]
            cells.append(mean(values))
        print(f"{scene} | " + " | ".join(cells))


if __name__ == "__main__":
    main()
