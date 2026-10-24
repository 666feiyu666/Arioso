// Shared MoodMic vocabulary and helpers, used by the MoodMic page (/) and the
// mood calendar page (/calendar.html).
//
// Four colour groups. The group is the colour itself; each colour holds several
// related emotion words, and selecting a word keeps its colour. The meaning
// behind each colour (energy and pleasantness) is explained on the help page,
// not in the interface.

export const GROUPS = [
  {
    id: "coral", color: "#E87575",
    energy: "high", pleasant: false,
    name: { zh: "红色", en: "Red" },
    meaning: { zh: "高能量 · 不愉快", en: "High energy · unpleasant" },
    emotions: [
      { id: "anxious", zh: "焦虑", en: "Anxious" },
      { id: "angry", zh: "愤怒", en: "Angry" },
      { id: "frustrated", zh: "烦闷", en: "Frustrated" },
      { id: "overwhelmed", zh: "不堪重负", en: "Overwhelmed" },
    ],
  },
  {
    id: "gold", color: "#E9BD46",
    energy: "high", pleasant: true,
    name: { zh: "黄色", en: "Yellow" },
    meaning: { zh: "高能量 · 愉快", en: "High energy · pleasant" },
    emotions: [
      { id: "excited", zh: "兴奋", en: "Excited" },
      { id: "joyful", zh: "喜悦", en: "Joyful" },
      { id: "energised", zh: "充满活力", en: "Energised" },
      { id: "enthusiastic", zh: "热情", en: "Enthusiastic" },
    ],
  },
  {
    id: "blue", color: "#779DD6",
    energy: "low", pleasant: false,
    name: { zh: "蓝色", en: "Blue" },
    meaning: { zh: "低能量 · 不愉快", en: "Low energy · unpleasant" },
    emotions: [
      { id: "sad", zh: "难过", en: "Sad" },
      { id: "lonely", zh: "孤单", en: "Lonely" },
      { id: "drained", zh: "疲惫", en: "Drained" },
      { id: "discouraged", zh: "气馁", en: "Discouraged" },
    ],
  },
  {
    id: "sage", color: "#83B59A",
    energy: "low", pleasant: true,
    name: { zh: "绿色", en: "Green" },
    meaning: { zh: "低能量 · 愉快", en: "Low energy · pleasant" },
    emotions: [
      { id: "calm", zh: "平静", en: "Calm" },
      { id: "content", zh: "满足", en: "Content" },
      { id: "relaxed", zh: "放松", en: "Relaxed" },
      { id: "peaceful", zh: "安宁", en: "Peaceful" },
    ],
  },
];

export function groupById(id) {
  return GROUPS.find((group) => group.id === id) ?? GROUPS[0];
}

export function emotionLabel(groupId, emotionId, language) {
  const emotion = groupById(groupId).emotions.find((item) => item.id === emotionId);
  if (!emotion) return emotionId;
  return language === "en" ? emotion.en : emotion.zh;
}

/**
 * Emotion words are not limited to the four per colour: anything the user types
 * is stored as-is, so a word with no built-in id is already the display text.
 */
export function isCustomEmotion(groupId, emotion) {
  if (!emotion) return false;
  return !groupById(groupId).emotions.some((item) => item.id === emotion);
}

/** The word to prefill the custom field with, or "" when a built-in word is chosen. */
export function customEmotionDraft(groupId, emotion) {
  return isCustomEmotion(groupId, emotion) ? String(emotion) : "";
}

export function groupName(group, language) {
  return language === "en" ? group.name.en : group.name.zh;
}

export function groupMeaning(group, language) {
  return language === "en" ? group.meaning.en : group.meaning.zh;
}

export const WEEKDAYS = {
  "zh-CN": ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function formatDayLabel(date, language) {
  const { year, month, day } = dateParts(date);
  return language === "en"
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${year} 年 ${month} 月 ${day} 日`;
}

// Marker background for one calendar day: solid for a single colour, or equal
// colour segments in the given order, clockwise from the top.
export function markerStyle(colors) {
  if (colors.length <= 1) return `background:${colors[0] ?? "transparent"}`;
  const n = colors.length;
  const stops = colors
    .map((color, index) => `${color} ${((index * 360) / n).toFixed(3)}deg ${(((index + 1) * 360) / n).toFixed(3)}deg`)
    .join(", ");
  return `background: conic-gradient(from 0deg, ${stops})`;
}

export function entryHasMusic(entry) {
  return (entry.tasks ?? []).some((task) => task.status === "completed");
}

export async function api(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message = (data && data.error) || "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return data;
}

export function applyI18n(dict, language) {
  const active = dict[language] ?? dict["zh-CN"];
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const value = active[node.dataset.i18n];
    if (typeof value === "string") node.textContent = value;
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    const value = active[node.dataset.i18nAriaLabel];
    if (typeof value === "string") node.setAttribute("aria-label", value);
  }
  if (typeof active.pageTitle === "string") document.title = active.pageTitle;
}

export async function readLanguage() {
  try {
    const settings = await api("/api/settings");
    if (settings?.language === "en" || settings?.language === "zh-CN") return settings.language;
  } catch {
    /* Fall back to the default language. */
  }
  return "zh-CN";
}

export async function persistLanguage(language) {
  try {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
  } catch {
    /* Best-effort preference. */
  }
}
