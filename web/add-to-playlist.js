// "Add to playlist" — one panel shared by every place a finished piece appears.
//
// A playlist references pieces that already exist, so this panel only offers
// places to put them: an existing playlist, or a new one named in the panel
// itself. Nothing here asks an album to generate, plan, or revise anything.

const COPY = {
  "zh-CN": {
    title: "加入歌单",
    lead: (n) => (n > 1
      ? `把这 ${n} 首曲子放进一张歌单。歌单只引用它们，不会重新生成。`
      : "把这首曲子放进一张歌单。歌单只引用它，不会重新生成。"),
    newPlaylist: "＋ 新建歌单",
    nameLabel: "新歌单的名字",
    namePlaceholder: "例如：深夜写作",
    create: "创建并加入",
    cancel: "取消",
    empty: "还没有歌单。给新歌单起个名字，就可以把它放进去了。",
    close: "关闭",
    done: (name) => `已加入「${name}」`,
    doneNew: (name) => `已创建「${name}」并加入`,
    error: "没有加入成功，请再试一次。",
    tracks: (n) => `${n} 首`,
  },
  en: {
    title: "Add to playlist",
    lead: (n) => (n > 1
      ? `Put these ${n} pieces in a playlist. A playlist references them and never regenerates them.`
      : "Put this piece in a playlist. A playlist references it and never regenerates it."),
    newPlaylist: "＋ New playlist",
    nameLabel: "New playlist name",
    namePlaceholder: "e.g. Late-night writing",
    create: "Create and add",
    cancel: "Cancel",
    empty: "No playlists yet. Give a new one a name and this lands in it.",
    close: "Close",
    done: (name) => `Added to "${name}"`,
    doneNew: (name) => `Created "${name}" and added`,
    error: "That did not work. Try again.",
    tracks: (n) => `${n} track${n === 1 ? "" : "s"}`,
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
    let playlists = null;
    let message = "";
    let error = false;
    let busy = false;
    // Naming a new playlist happens inside the panel: no browser prompt.
    let naming = false;
    let name = "";
    let closeTimer = null;

    const close = (added) => {
      if (closeTimer) clearTimeout(closeTimer);
      panel.remove();
      document.removeEventListener("keydown", onKey);
      resolve(Boolean(added));
    };
    const settle = (added) => {
      // Long enough to read the confirmation, short enough not to feel stuck.
      closeTimer = setTimeout(() => close(added), 900);
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (naming) {
        // The first Escape steps out of naming; a second one closes the panel.
        naming = false;
        name = "";
        draw();
        return;
      }
      close(false);
    };
    document.addEventListener("keydown", onKey);

    const addTo = async (playlistId, playlistName) => {
      if (busy) return;
      busy = true;
      error = false;
      message = "";
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
          message = t(language, "doneNew", playlistName);
        }
        busy = false;
        draw();
        settle(true);
      } catch {
        busy = false;
        error = true;
        message = t(language, "error");
        draw();
      }
    };

    const createNew = () => {
      const trimmed = name.trim();
      if (!trimmed || busy) return;
      void addTo(undefined, trimmed);
    };

    const rows = () => playlists.map((entry) => `
      <button class="atp-row" type="button" data-atp-add="${esc(entry.playlist.id)}" data-atp-name="${esc(entry.playlist.name)}" ${busy ? "disabled" : ""}>
        <span class="atp-row-name">${esc(entry.playlist.name)}</span>
        <span class="atp-row-count num">${esc(t(language, "tracks", entry.items.length))}</span>
      </button>`).join("");

    const namingMarkup = () => `
      <form class="atp-new-form" novalidate>
        <label class="atp-field">
          <span>${esc(t(language, "nameLabel"))}</span>
          <input class="atp-input" type="text" maxlength="80" autocomplete="off"
            placeholder="${esc(t(language, "namePlaceholder"))}" value="${esc(name)}" ${busy ? "disabled" : ""} />
        </label>
        <div class="atp-new-actions">
          <button class="atp-create" type="submit" ${busy || !name.trim() ? "disabled" : ""}>${esc(t(language, "create"))}</button>
          <button class="atp-cancel" type="button" data-atp-cancel ${busy ? "disabled" : ""}>${esc(t(language, "cancel"))}</button>
        </div>
      </form>`;

    const draw = async () => {
      if (!playlists) {
        try {
          const body = await api("/api/playlists");
          playlists = Array.isArray(body) ? body : [];
        } catch {
          playlists = [];
        }
        // With nothing to choose from, naming a playlist is the only next step.
        if (!playlists.length) naming = true;
      }
      panel.innerHTML = `
        <div class="atp-scrim" data-atp-close></div>
        <div class="atp-panel" role="dialog" aria-modal="true" aria-labelledby="atp-title">
          <header class="atp-head">
            <h2 id="atp-title">${esc(t(language, "title"))}</h2>
            <button class="atp-close" type="button" data-atp-close aria-label="${esc(t(language, "close"))}">✕</button>
          </header>
          <p class="atp-lead">${esc(t(language, "lead", items.length))}</p>
          <div class="atp-body">
            ${playlists.length
              ? `<div class="atp-list">${rows()}</div>`
              : `<p class="atp-empty">${esc(t(language, "empty"))}</p>`}
          </div>
          <footer class="atp-foot${error ? " is-error" : ""}">
            ${message ? `<p class="atp-message" role="status">${esc(message)}</p>` : ""}
            ${naming
              ? namingMarkup()
              : `<button class="atp-new" type="button" data-atp-new ${busy ? "disabled" : ""}>${esc(t(language, "newPlaylist"))}</button>`}
          </footer>
        </div>`;

      panel.querySelectorAll("[data-atp-close]").forEach((node) =>
        node.addEventListener("click", () => close(false)));
      panel.querySelectorAll("[data-atp-add]").forEach((node) =>
        node.addEventListener("click", () => void addTo(node.dataset.atpAdd, node.dataset.atpName)));
      panel.querySelector("[data-atp-new]")?.addEventListener("click", () => {
        naming = true;
        name = "";
        message = "";
        error = false;
        draw();
      });
      panel.querySelector("[data-atp-cancel]")?.addEventListener("click", () => {
        naming = false;
        name = "";
        draw();
      });

      const form = panel.querySelector(".atp-new-form");
      const input = panel.querySelector(".atp-input");
      const create = panel.querySelector(".atp-create");
      if (form && input && create) {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          createNew();
        });
        // Typing only refreshes the submit state: redrawing would drop the caret.
        input.addEventListener("input", () => {
          name = input.value;
          create.disabled = busy || !name.trim();
        });
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    };

    document.body.append(panel);
    void draw();
  });
}
