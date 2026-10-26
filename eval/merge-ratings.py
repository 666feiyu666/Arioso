"""合并听众从盲听页面导出的评分 CSV。

把听众返回的 `ratings-*.csv` 放进 `eval/blind/collected/`，然后运行：
  python eval/merge-ratings.py

合并结果写到 `eval/blind/ratings-collected.csv`。同一（听众，音频）出现多次时，保留最后一条。
"""

import csv
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLIND = os.path.join(ROOT, "eval", "blind")
COLLECTED = os.path.join(BLIND, "collected")
OUT = os.path.join(BLIND, "ratings-collected.csv")

FIELDS = [
    "听众编号", "场景编号", "音频编号", "播放顺序",
    "情绪适配_1到5", "需求达成_1到5", "保留选择", "理由",
]


def main() -> None:
    files = sorted(glob.glob(os.path.join(COLLECTED, "*.csv")))
    if not files:
        raise SystemExit(f"{os.path.relpath(COLLECTED, ROOT)}/ 里没有 CSV 文件")

    merged: dict[tuple[str, str], dict[str, str]] = {}
    for path in files:
        with open(path, encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                merged[(row["听众编号"], row["音频编号"])] = row

    rows = list(merged.values())
    with open(OUT, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    listeners = sorted({row["听众编号"] for row in rows})
    print(f"文件 {len(files)} 份 | 听众 {len(listeners)} 位 | 评分 {len(rows)} 条")
    print(f"已写入 {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
