import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { MOOD_GROUPS, type MoodGroup } from "./mood-store.js";

// The emotion vocabulary shared with the MoodMic interface. Every word belongs
// to one of the four colour groups.
const EMOTION_GROUPS: Record<string, MoodGroup> = {
  anxious: "coral", angry: "coral", frustrated: "coral", overwhelmed: "coral",
  excited: "gold", joyful: "gold", energised: "gold", enthusiastic: "gold",
  sad: "blue", lonely: "blue", drained: "blue", discouraged: "blue",
  calm: "sage", content: "sage", relaxed: "sage", peaceful: "sage",
};

export const EMOTIONS = Object.keys(EMOTION_GROUPS);

// Bilingual cues for the offline fallback. Chinese cues match substrings; Latin
// cues match on word boundaries.
const LEXICON: Record<string, string[]> = {
  anxious: ["焦虑", "紧张", "担心", "不安", "慌", "anxious", "nervous", "worried", "uneasy", "stress", "stressed"],
  angry: ["愤怒", "生气", "火大", "恼火", "气死", "angry", "mad", "furious", "rage", "irate"],
  frustrated: ["烦闷", "烦躁", "挫败", "烦", "frustrated", "annoyed", "stuck", "irritated"],
  overwhelmed: ["崩溃", "受不了", "压垮", "累垮", "招架不住", "overwhelmed", "swamped", "too much", "overloaded"],
  excited: ["兴奋", "激动", "期待", "excited", "thrilled", "pumped", "looking forward"],
  joyful: ["开心", "高兴", "快乐", "喜悦", "幸福", "愉快", "happy", "joyful", "glad", "delighted", "cheerful"],
  energised: ["活力", "精力", "元气", "充满能量", "energised", "energized", "energetic", "vibrant", "alive"],
  enthusiastic: ["热情", "积极", "enthusiastic", "motivated", "eager", "keen"],
  sad: ["难过", "伤心", "悲伤", "低落", "沮丧", "sad", "down", "unhappy", "grief", "sorrow"],
  lonely: ["孤独", "孤单", "寂寞", "没人", "lonely", "alone", "isolated"],
  drained: ["疲惫", "疲倦", "很累", "没力气", "乏力", "drained", "tired", "exhausted", "worn out", "fatigue"],
  discouraged: ["气馁", "泄气", "失望", "灰心", "discouraged", "hopeless", "defeated", "disheartened"],
  calm: ["平静", "冷静", "安静", "镇定", "calm", "quiet", "serene", "settled"],
  content: ["满足", "满意", "知足", "content", "satisfied", "fulfilled"],
  relaxed: ["放松", "轻松", "舒缓", "relaxed", "at ease", "chill", "unwound"],
  peaceful: ["安宁", "祥和", "peaceful", "tranquil", "harmonious"],
};

export interface MoodClassification {
  group: MoodGroup | null;
  emotion: string | null;
  source: "model" | "heuristic";
}

export interface MoodClassifierOptions {
  apiKey: string;
  model: string;
  language: "zh-CN" | "en";
}

export interface MoodClassifier {
  classify(text: string, options: MoodClassifierOptions): Promise<MoodClassification>;
}

function latinCue(cue: string): boolean {
  return /^[a-z][a-z ]*$/u.test(cue);
}

function countCues(haystack: string, cue: string): number {
  if (latinCue(cue)) {
    const pattern = new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "gu");
    return (haystack.match(pattern) ?? []).length;
  }
  let count = 0;
  let index = haystack.indexOf(cue);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(cue, index + cue.length);
  }
  return count;
}

/** Offline fallback: pick the emotion whose cues appear most in the text. */
export function heuristicClassify(text: string): MoodClassification {
  const haystack = text.toLowerCase();
  let best: { emotion: string; score: number } | null = null;
  for (const emotion of EMOTIONS) {
    const score = (LEXICON[emotion] ?? []).reduce((sum, cue) => sum + countCues(haystack, cue), 0);
    if (score > 0 && (!best || score > best.score)) best = { emotion, score };
  }
  if (!best) return { group: null, emotion: null, source: "heuristic" };
  return { group: EMOTION_GROUPS[best.emotion]!, emotion: best.emotion, source: "heuristic" };
}

const suggestionSchema = z.object({
  emotion: z
    .enum(EMOTIONS as [string, ...string[]])
    .nullable()
    .describe("Exactly one emotion id from the supplied list, or null when nothing fits."),
});

const SYSTEM_INSTRUCTIONS = [
  "You read how a person feels and map it to one emotion word.",
  `Choose exactly one id from: ${EMOTIONS.join(", ")}.`,
  "Pick the single closest word even when the text is brief or mixed-language.",
  "Only return null when the text carries no feeling at all (for example a question about the weather).",
  "Do not invent new ids and do not explain.",
].join(" ");

function model(options: MoodClassifierOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
    useResponsesApi: true,
  });
}

/** Reads the model suggestion, falling back to the offline lexicon on any error. */
export async function classifyMood(text: string, options: MoodClassifierOptions): Promise<MoodClassification> {
  const input = text.trim();
  if (!input) return { group: null, emotion: null, source: "heuristic" };
  // Without a usable key there is no point contacting the model.
  if (!options.apiKey) return heuristicClassify(input);
  try {
    const suggestion = await model(options)
      .withStructuredOutput(suggestionSchema, { name: "mood_suggestion" })
      .invoke([
        new SystemMessage(`${SYSTEM_INSTRUCTIONS} The user's language is ${options.language}.`),
        new HumanMessage(input.slice(0, 2000)),
      ]);
    const emotion = suggestion?.emotion ?? null;
    if (emotion && EMOTION_GROUPS[emotion]) {
      return { group: EMOTION_GROUPS[emotion]!, emotion, source: "model" };
    }
    // The model answered with something outside the vocabulary (or nothing);
    // try the offline cues before giving up.
    return heuristicClassify(input);
  } catch {
    return heuristicClassify(input);
  }
}

export class LangChainMoodClassifier implements MoodClassifier {
  classify(text: string, options: MoodClassifierOptions): Promise<MoodClassification> {
    return classifyMood(text, options);
  }
}

export { MOOD_GROUPS };
