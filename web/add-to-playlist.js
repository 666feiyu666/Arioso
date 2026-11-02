// "Add to playlist" — one panel shared by every place a finished piece appears.
//
// A playlist references pieces that already exist, so this panel only offers
// places to put them: an existing playlist, or a new one named on the spot.
// Nothing here asks an album to generate, plan, or revise anything.

const COPY = {
  "zh-CN": {
    title: "加入歌单",
    lead: "把这首曲子放进一张歌单。歌单只引用它，不会重新生成。",
    newPlaylist: "＋ 新建歌单",
    namePrompt: "歌单名字",
    defaultName: "我的歌单",
    empty: "还没有歌单，先新建一张。",
    close: "关闭",
    done: (name) => `已加入「${name}」`,
    doneNew: "已新建歌单并加入",
    error: "没有加入成功，请再试一次。",
    tracks: (n) => `${n} 首`,
  },
  en: {
    title: "Add to playlist",
    lead: "Put this piece in a playlist. A playlist references it and never regenerates it.",
    newPlaylist: "＋ New playlist",
    namePrompt: "Playlist name",
    defaultName: "My playlist",
    empty: "No playlists yet. Create one first.",
    close: "Close",
    done: (name) => `Added to "${name}"`,
    doneNew: "New playlist created",
    error: "That did not work. Try again.",
    tracks: (n) => `${n} track(s)`,
  },
};

function t(language, key, ...args) {
  const value = COPY[language]?.[key] ?? COPY.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

/**
 * Opens the panel for one or more pieces.
 *
 * `items` are playlist entries: `{ source, titleSnapshot?, durationSeconds? }`,
 * where `source` is `{ kind: "task", taskId }` or
 * `{ kind: "album-track", taskId, trackId }`.
 */
export function openAddToPlaylist({ api, language = "zh-CN", items }) {
  if (!items?.length) return Promise.resolve(false);
  return new Promise((resolve) => {
    const panel = document.createElement("div");
    panel.className = "atp-layer";
    let message = "";
    let busy = false;

    const close = (added) => {
      panel.remove();
      document.removeEventListener("keydown", onKey);
      resolve(Boolean(added));
    };
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);

    const body = () => {
      const payload = JSON.stringify({ items });
      return api;
    };

    const addTo = async (playlistId, playlistName) => {
      if (busy) return;
      busy = true;
      draw();
      try {
        if (playlistId) {
          await api(`/api/playlists/${encodeURIComponent(playlistId)}/items`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          message = t(language, "done", playlistName);
        } else {
          await api("/api/playlists", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: playlistName, items }),
          });
          message = t(language, "doneNew");
        }
        setTimeout(() => close(true), 700);
      } catch {
        message = t(language, "error");
      } finally {
        busy = false;
        draw();
      }
    };

    const draw = async (playlists) => {
      let list = playlists;
      if (!list) {
        try {
          const body_ = await api("/api/playlists");
          list = Array.isArray(body_) ? body_ : [];
        } catch {
          list = [];
        }
      }
      panel.innerHTML = `
        <div class="atp-scrim" data-atp-close></div>
        <div class="atp-panel" role="dialog" aria-modal="true" aria-label="${esc(t(language, "title"))}">
          <header class="atp-head">
            <h2>${esc(t(language, "title"))}</h2>
            <button class="atp-close" type="button" data-atp-close aria-label="${esc(t(language, "close"))}">✕</button>
          </header>
          <p class="atp-lead">${esc(t(language, "lead"))}</p>
          <div class="atp-list">
            ${list.length
              ? list.map((entry) => `
                <button class="atp-row" type="button" data-atp-add="${esc(entry.playlist.id)}" data-atp-name="${esc(entry.playlist.name)}">
                  <strong>${esc(entry.playlist.name)}</strong>
                  <span>${esc(t(language, "tracks", entry.items.length))}</span>
                </button>`).join("")
              : `<p class="atp-empty">${esc(t(language, "empty"))}</p>`}
          </div>
          <footer class="atp-foot">
            ${message ? `<span class="atp-message">${esc(message)}</span>` : ""}
            <button class="atp-new" type="button" data-atp-new ${busy ? "disabled" : ""}>${esc(t(language, "newPlaylist"))}</button>
          </footer>
        </div>`;
      panel.querySelectorAll("[data-atp-close]").forEach((node) =>
        node.addEventListener("click", () => close(false)));
      panel.querySelectorAll("[data-atp-add]").forEach((node) =>
        node.addEventListener("click", () => void addTo(node.dataset.atpAdd, node.dataset.atpName)));
      panel.querySelector("[data-atp-new]")?.addEventListener("click", () => {
        const name = window.prompt(t(language, "namePrompt"), t(language, "defaultName"));
        if (name === null) return;
        void addTo(undefined, name.trim() || t(language, "defaultName"));
      });
    };

    document.body.append(panel);
    void draw();
  });
}
