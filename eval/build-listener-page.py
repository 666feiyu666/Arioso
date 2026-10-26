"""Build a self-contained listener page and a distributable zip.

Reads eval/blind/inventory.json (already blinded), writes eval/blind/listen.html
with the data inlined so it works from file:// without a server, and packages
listen.html + audio/ + a listener readme into eval/blind-test.zip. key.json is
never included.

Run from the repository root:
  python eval/build-listener-page.py
"""

import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLIND = os.path.join(ROOT, "eval", "blind")
AUDIO = os.path.join(BLIND, "audio")

HTML = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arioso 盲听评分</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; max-width: 920px; margin: 24px auto; padding: 0 16px; color: #1f2a37; background: #fff; }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; margin-top: 32px; border-top: 1px solid #e1e6eb; padding-top: 16px; }
  .need { color: #64727f; font-size: 14px; }
  .card { border: 1px solid #e1e6eb; border-radius: 8px; padding: 12px; margin: 12px 0; background: #f9fafb; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: 8px; }
  label { font-size: 13px; color: #3e4c59; }
  select, textarea { font-size: 13px; padding: 2px 4px; }
  select { min-width: 64px; }
  textarea { width: 100%; min-height: 38px; margin-top: 6px; box-sizing: border-box; }
  audio { width: 100%; margin-top: 6px; }
  button { font-size: 15px; padding: 8px 16px; border-radius: 8px; border: 0; background: #12233a; color: #fff; cursor: pointer; }
  .hint { font-size: 12px; color: #64727f; }
</style>
</head>
<body>
<h1>Arioso 盲听评分</h1>
<p class="hint">每个场景先看“初始消息”和“隐含需求”，再把该场景的音频完整听一遍，然后逐段打分。1 分是很不合适，5 分是很合适。别根据文件名猜条件，听的时候也不要打开别的文件。</p>
<p><label>听众编号：<input id="listener" value="P01" size="8"></label></p>
<div id="app"></div>
<p><button id="export">导出我的评分（CSV）</button> <span id="status" class="hint"></span></p>
<script>
const DATA = __DATA__;

function scoreSelect(audioId, cls, values) {
  return '<select class="' + cls + '" data-audio="' + audioId + '"><option value="">&ndash;</option>' +
    values.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('') +
    '</select>';
}

function render() {
  const app = document.getElementById('app');
  DATA.scenarios.forEach(function (sc) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = '场景 ' + sc.scenario_id;
    section.appendChild(heading);
    const msg = document.createElement('div');
    msg.textContent = '初始消息：' + sc.initial_message;
    section.appendChild(msg);
    const need = document.createElement('div');
    need.className = 'need';
    need.textContent = '隐含需求：' + sc.underlying_need;
    section.appendChild(need);

    sc.audio.forEach(function (a) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div><b>' + a.audio_id + '</b> <span class="hint">第 ' + a.presentation_order + ' 段</span></div>' +
        '<audio controls preload="none" src="' + a.file + '"></audio>' +
        '<div class="row">' +
          '<label>情绪适配 ' + scoreSelect(a.audio_id, 'fit', ['1', '2', '3', '4', '5']) + '</label>' +
          '<label>需求达成 ' + scoreSelect(a.audio_id, 'need', ['1', '2', '3', '4', '5']) + '</label>' +
          '<label>保留选择 <select class="retain" data-audio="' + a.audio_id + '">' +
            '<option value="">&ndash;</option>' +
            '<option value="' + a.audio_id + '">保留这一段</option>' +
            '<option value="无明显差别">无明显差别</option>' +
          '</select></label>' +
        '</div>' +
        '<textarea class="reason" data-audio="' + a.audio_id + '" placeholder="可选：一句话理由"></textarea>';
      section.appendChild(card);
    });
    app.appendChild(section);
  });
}

function valueOf(selector) {
  const node = document.querySelector(selector);
  return node && node.value ? node.value : '';
}

document.getElementById('export').addEventListener('click', function () {
  const listener = document.getElementById('listener').value.trim() || 'anonymous';
  const esc = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
  const rows = [['听众编号', '场景编号', '音频编号', '播放顺序',
    '情绪适配_1到5', '需求达成_1到5', '保留选择', '理由']];
  DATA.scenarios.forEach(function (sc) {
    sc.audio.forEach(function (a) {
      rows.push([
        listener, sc.scenario_id, a.audio_id, a.presentation_order,
        valueOf('select.fit[data-audio="' + a.audio_id + '"]'),
        valueOf('select.need[data-audio="' + a.audio_id + '"]'),
        valueOf('select.retain[data-audio="' + a.audio_id + '"]'),
        valueOf('textarea.reason[data-audio="' + a.audio_id + '"]'),
      ]);
    });
  });
  const csv = '\\ufeff' + rows.map(function (row) { return row.map(esc).join(','); }).join('\\r\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ratings-' + listener + '.csv';
  link.click();
  URL.revokeObjectURL(url);
  document.getElementById('status').textContent = '已导出 ratings-' + listener + '.csv，请发给研究者。';
});

render();
</script>
</body>
</html>
"""

LISTENER_README = """# 盲听评分说明

听音频、打分，就这两件事，不用懂技术。

1. 双击 `listen.html`，不用联网。
2. 填上研究者给你的听众编号，比如 P01。
3. 每个场景先看“初始消息”和“隐含需求”，再把 6 段音频按顺序听完。
4. 每段听完打两个分，都是 1 到 5：
   - 情绪适配：这段音乐像不像用户此刻的心情？
   - 需求达成：这段音乐能不能帮用户做成想做的事？（这个更重要）
   - 保留选择：可选。如果你是这位用户，会不会留下这一段。
   - 理由：可选，一句话就行。
5. 全部听完点“导出我的评分（CSV）”，把下载的 `ratings-你的编号.csv` 发回给研究者。

几点注意：
- 一共 4 个场景、每个 6 段，每段大约 3 分钟，留出 40 分钟左右。
- 顺序是打乱的，文件名也看不出条件，按页面顺序听就好。
- 建议戴耳机，找个安静的地方，音量保持一致。
- 除了 `listen.html` 和 `audio/`，别的文件不用打开。
"""


def main() -> None:
    inventory = json.load(open(os.path.join(BLIND, "inventory.json"), encoding="utf-8"))
    # The page lives next to audio/, so rewrite each path to a relative one.
    for scenario in inventory["scenarios"]:
        for audio in scenario["audio"]:
            audio["file"] = f"audio/{audio['audio_id']}.mp3"

    data = json.dumps(inventory, ensure_ascii=False).replace("</", "<\\/")
    html = HTML.replace("__DATA__", data)
    page_path = os.path.join(BLIND, "listen.html")
    with open(page_path, "w", encoding="utf-8") as handle:
        handle.write(html)

    readme_path = os.path.join(BLIND, "README-listener.md")
    with open(readme_path, "w", encoding="utf-8") as handle:
        handle.write(LISTENER_README)

    zip_path = os.path.join(ROOT, "eval", "blind-test.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(page_path, "listen.html")
        archive.write(readme_path, "README-listener.md")
        for name in sorted(os.listdir(AUDIO)):
            if name.endswith(".mp3"):
                archive.write(os.path.join(AUDIO, name), f"audio/{name}")

    print(f"page: {os.path.relpath(page_path, ROOT)}")
    print(f"zip:  {os.path.relpath(zip_path, ROOT)} ({os.path.getsize(zip_path) // 1024} KB)")
    print("zip excludes key.json; listeners only see listen.html + audio/")


if __name__ == "__main__":
    main()
