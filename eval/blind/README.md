# 盲听清单与评分表

本目录由 `eval/make-blind-sheet.py` 生成，用于 `docs/DH6012-Documentation/DH6012_Eval.md` 的盲听环节。**条件和音乐类型已隐藏**，听音者不应打开 `key.json`。

## 文件

| 文件 | 用途 |
|---|---|
| `audio/` | 24 段匿名音频：每个场景 6 段（1 段 baseline + 5 种音乐类型），文件名已中性化（`S01-1.mp3` …） |
| `inventory.json` | 给听音者的清单：场景、初始消息、隐含需求、匿名音频 ID 与播放顺序 |
| `ratings-template.csv` | 评分表：12 位听众 × 24 段 = 288 行，评分列留空待填 |
| `key.json` | **仅研究者**：匿名 ID → 条件（baseline / arioso）/ 音乐类型 / 源文件 / sha256 |

## 听音流程

1. 打开 `inventory.json`，按场景分组。
2. 每个场景先读 `initial_message`（用户最初说的话）和 `underlying_need`（隐含需求）。
3. 按 `presentation_order` 依次听该场景的 6 段音频（**顺序已随机**，不要按文件名推断）。
4. 每听完一段，在 `ratings-template.csv` 对应行填写评分；再进入下一个场景。

## 评分问题

对每段音频回答（对应 CSV 列）：

1. **Emotional-state fit**（`emotional_fit_1to5`）：这段音乐对用户**当前情绪状态**的适配程度，1–5。
2. **Need fulfilment**（`need_fulfilment_1to5`）：这段音乐帮助用户**达成预期结果**的程度，1–5（主指标）。
3. **Retention choice**（`retention_choice`）：若你是这位用户，你会保留哪一段？填 `audio_id`、`A`/`B` 或 `No clear difference`。**当前逐段评分阶段可留空**，等配对方案（baseline vs 哪种类型）确定后再用。
4. **Reason**（`reason`）：可选，一句话说明理由。

## 说明

- 每段音频均约 3 分钟，未做音量/响度统一；如需要可先统一 `ffmpeg loudnorm` 再听。
- `retention_choice` 需要先确定「哪两段配成一对」。原 `DH6012_Eval.md` 是每场景 baseline 对 Arioso 一对；现在 Arioso 有 5 个类型变体，配对方式待定。
- 复现生成：`python eval/make-blind-sheet.py`（固定 seed，结果可复现）。
