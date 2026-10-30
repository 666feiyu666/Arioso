// Shared settings dialog: interface language, API keys and the "remember"
// switch. It owns its markup, copy and requests so any page can open it with a
// single call:
//
//   openSettingsDialog({ language, onSaved })
//
// The workflow studio still carries its own copy of this dialog inside app.js;
// this module is what the MoodMic home page uses.

import { api } from "./mood-common.js";

const COPY = {
  "zh-CN": {
    settings: "设置",
    close: "关闭",
    interfaceLanguage: "界面语言",
    apiConfiguration: "API 配置",
    apiNeverShown: "密钥只保存在本机，界面不会回显完整内容。",
    apiKeyPlaceholder: "输入新 Key；留空则保留当前配置",
    testConnection: "测试连接",
    removeSavedKey: "移除已保存的 Key",
    confirmRemoveKey: "确认移除",
    rememberApiKeys: "记住 API Key",
    rememberApiKeysHelp: "开启后写入本机 .env；关闭后仅在本次服务运行期间使用。",
    cancel: "取消",
    save: "保存",
    configuredKey: "已配置 · {masked}",
    missingKey: "尚未配置",
    settingsLoadFailed: "无法读取设置。",
    settingsSaveFailed: "无法保存设置。",
    testingConnection: "正在测试连接…",
    connectionOk: "连接成功。",
    connectionFailed: "连接失败，请检查 API Key 和网络连接。",
    keyCleared: "已移除保存的 API Key。",
    keyFallback: "已移除本地保存的 Key；当前仍检测到环境变量中的可用 Key。",
  },
  en: {
    settings: "Settings",
    close: "Close",
    interfaceLanguage: "Interface language",
    apiConfiguration: "API configuration",
    apiNeverShown: "Keys stay on this computer and are never displayed in full.",
    apiKeyPlaceholder: "Enter a new key; leave blank to keep the current one",
    testConnection: "Test connection",
    removeSavedKey: "Remove saved key",
    confirmRemoveKey: "Remove now",
    rememberApiKeys: "Remember API keys",
    rememberApiKeysHelp: "When enabled, keys are written to the local .env; otherwise they last only for this server session.",
    cancel: "Cancel",
    save: "Save",
    configuredKey: "Configured · {masked}",
    missingKey: "Not configured",
    settingsLoadFailed: "Settings could not be loaded.",
    settingsSaveFailed: "Settings could not be saved.",
    testingConnection: "Testing connection…",
    connectionOk: "Connection successful.",
    connectionFailed: "Connection failed. Check the API key and network connection.",
    keyCleared: "The saved API key was removed.",
    keyFallback: "The locally saved key was removed; a key is still available from the environment.",
  },
};

const PROVIDERS = [
  { id: "openai", label: "OpenAI API Key" },
  { id: "gemini", label: "Gemini API Key" },
];

const elements = {};
const state = {
  language: "zh-CN",
  settings: null,
  onSaved: null,
  // Provider whose "remove" button is waiting for its second, confirming click.
  confirming: null,
};

function t(key, vars) {
  const dictionary = COPY[state.language] ?? COPY["zh-CN"];
  let value = dictionary[key] ?? COPY["zh-CN"][key] ?? key;
  for (const [name, replacement] of Object.entries(vars ?? {})) {
    value = value.replace(`{${name}}`, replacement);
  }
  return value;
}

function credentialCard(provider) {
  return `
    <div class="credential-card">
      <div class="credential-heading">
        <label for="settings-key-${provider.id}">${provider.label}</label>
        <span class="credential-status" data-status="${provider.id}"></span>
      </div>
      <input id="settings-key-${provider.id}" type="password" autocomplete="off" data-key="${provider.id}" />
      <div class="credential-actions">
        <button type="button" class="secondary-button" data-test="${provider.id}"></button>
        <button type="button" class="text-button" data-remove="${provider.id}"></button>
      </div>
    </div>`;
}

function build() {
  if (elements.dialog) return;

  const dialog = document.createElement("dialog");
  dialog.className = "settings-dialog";
  dialog.id = "app-settings-dialog";
  dialog.setAttribute("aria-labelledby", "app-settings-title");
  dialog.innerHTML = `
    <form id="app-settings-form">
      <header class="settings-header">
        <div><h2 id="app-settings-title" data-copy="settings"></h2></div>
        <button class="dialog-close" type="button" data-close data-copy-aria="close">×</button>
      </header>

      <label class="settings-field">
        <span data-copy="interfaceLanguage"></span>
        <select data-language>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
      </label>

      <section class="api-settings" aria-labelledby="app-settings-api-title">
        <div class="settings-section-title">
          <h3 id="app-settings-api-title" data-copy="apiConfiguration"></h3>
          <p data-copy="apiNeverShown"></p>
        </div>
        ${PROVIDERS.map(credentialCard).join("")}
        <label class="remember-setting">
          <input type="checkbox" data-remember />
          <span>
            <strong data-copy="rememberApiKeys"></strong>
            <small data-copy="rememberApiKeysHelp"></small>
          </span>
        </label>
      </section>

      <p class="settings-message" role="status" data-message></p>
      <footer class="settings-footer">
        <button class="secondary-button" type="button" data-cancel data-copy="cancel"></button>
        <button class="primary-button" type="submit" data-save data-copy="save"></button>
      </footer>
    </form>`;

  document.body.append(dialog);

  elements.dialog = dialog;
  elements.form = dialog.querySelector("form");
  elements.language = dialog.querySelector("[data-language]");
  elements.remember = dialog.querySelector("[data-remember]");
  elements.message = dialog.querySelector("[data-message]");
  elements.save = dialog.querySelector("[data-save]");
  elements.keys = {};
  elements.statuses = {};
  elements.tests = {};
  elements.removes = {};
  for (const provider of PROVIDERS) {
    elements.keys[provider.id] = dialog.querySelector(`[data-key="${provider.id}"]`);
    elements.statuses[provider.id] = dialog.querySelector(`[data-status="${provider.id}"]`);
    elements.tests[provider.id] = dialog.querySelector(`[data-test="${provider.id}"]`);
    elements.removes[provider.id] = dialog.querySelector(`[data-remove="${provider.id}"]`);
  }

  dialog.querySelector("[data-close]").addEventListener("click", close);
  dialog.querySelector("[data-cancel]").addEventListener("click", close);
  dialog.addEventListener("close", () => {
    state.confirming = null;
    state.settings = null;
    state.onSaved = null;
  });

  // Choosing a language previews the dialog's own copy; the page follows once
  // the choice is saved.
  elements.language.addEventListener("change", () => {
    state.language = elements.language.value;
    renderCopy();
    renderCredentials();
  });

  elements.form.addEventListener("submit", save);

  for (const provider of PROVIDERS) {
    elements.tests[provider.id].addEventListener("click", () => testConnection(provider.id));
    elements.removes[provider.id].addEventListener("click", () => removeCredential(provider.id));
  }
}

function close() {
  elements.dialog?.close();
}

function setMessage(message, success = false) {
  elements.message.textContent = message;
  elements.message.classList.toggle("success", success);
}

function setBusy(button, busy) {
  button.disabled = busy;
}

function renderCopy() {
  for (const node of elements.dialog.querySelectorAll("[data-copy]")) {
    node.textContent = t(node.dataset.copy);
  }
  for (const node of elements.dialog.querySelectorAll("[data-copy-aria]")) {
    node.setAttribute("aria-label", t(node.dataset.copyAria));
  }
  for (const provider of PROVIDERS) {
    elements.keys[provider.id].placeholder = t("apiKeyPlaceholder");
    elements.tests[provider.id].textContent = t("testConnection");
  }
  renderCredentials();
}

function renderCredentials() {
  for (const provider of PROVIDERS) {
    const summary = state.settings?.credentials?.[provider.id];
    const status = elements.statuses[provider.id];
    status.textContent = summary?.configured
      ? t("configuredKey", { masked: summary.masked ?? "" })
      : t("missingKey");
    status.classList.toggle("configured", Boolean(summary?.configured));

    const remove = elements.removes[provider.id];
    const confirming = state.confirming === provider.id;
    remove.textContent = confirming ? t("confirmRemoveKey") : t("removeSavedKey");
    remove.classList.toggle("is-confirming", confirming);
    remove.hidden = !summary?.configured;
  }
}

/** Fill the dialog from the server, then show it. A failed load still opens the
 *  dialog so the reason is visible in its own message slot. */
async function open({ language, onSaved }) {
  build();
  if (elements.dialog.open) return;
  state.language = language === "en" ? "en" : "zh-CN";
  state.onSaved = onSaved ?? null;
  state.settings = null;
  state.confirming = null;
  setMessage("");
  renderCopy();

  try {
    const settings = await api("/api/settings");
    state.settings = settings;
    if (settings?.language === "en" || settings?.language === "zh-CN") {
      state.language = settings.language;
    }
    elements.language.value = state.language;
    elements.remember.checked = settings?.remember === true;
    for (const provider of PROVIDERS) elements.keys[provider.id].value = "";
    renderCopy();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("settingsLoadFailed"));
  }

  elements.dialog.showModal();
}

async function save(event) {
  event.preventDefault();
  setBusy(elements.save, true);
  setMessage("");

  const credentials = {};
  for (const provider of PROVIDERS) {
    const key = elements.keys[provider.id].value.trim();
    if (key) credentials[provider.id] = key;
  }

  try {
    const settings = await api("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: elements.language.value,
        remember: elements.remember.checked,
        ...(Object.keys(credentials).length ? { credentials } : {}),
      }),
    });
    state.settings = settings;
    const onSaved = state.onSaved;
    close();
    onSaved?.(settings);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    setBusy(elements.save, false);
  }
}

async function testConnection(provider) {
  const button = elements.tests[provider];
  setBusy(button, true);
  setMessage(t("testingConnection"));
  try {
    const result = await api("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        apiKey: elements.keys[provider].value.trim() || undefined,
      }),
    });
    setMessage(result?.ok ? t("connectionOk") : t("connectionFailed"), Boolean(result?.ok));
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("connectionFailed"));
  } finally {
    setBusy(button, false);
  }
}

/** First click arms the button, a second one within the same dialog session
 *  removes the saved key. */
async function removeCredential(provider) {
  if (state.confirming !== provider) {
    state.confirming = provider;
    renderCredentials();
    return;
  }

  const button = elements.removes[provider];
  setBusy(button, true);
  setMessage("");
  try {
    const settings = await api(`/api/settings/credentials/${provider}`, { method: "DELETE" });
    state.settings = settings;
    state.confirming = null;
    elements.keys[provider].value = "";
    renderCredentials();
    setMessage(settings.credentials[provider].configured ? t("keyFallback") : t("keyCleared"), true);
  } catch (error) {
    state.confirming = null;
    renderCredentials();
    setMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    setBusy(button, false);
  }
}

export function openSettingsDialog({ language = "zh-CN", onSaved } = {}) {
  return open({ language, onSaved });
}
