import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_DIRECTORY = path.resolve(
  process.env.ARIOSO_PROMPT_DIRECTING_SKILL ?? path.join("skills", "prompt-directing-skill"),
);

export type PromptDirectingPhase = "discussion" | "proposal";

const cachedSkills = new Map<PromptDirectingPhase, Promise<string>>();

export function loadPromptDirectingSkill(phase: PromptDirectingPhase): Promise<string> {
  const cached = cachedSkills.get(phase);
  if (cached) return cached;

  const loaded = Promise.all([
    readFile(path.join(SKILL_DIRECTORY, "SKILL.md"), "utf8"),
    readFile(path.join(SKILL_DIRECTORY, "references", `${phase}.md`), "utf8"),
  ])
    .then((parts) => parts.map((part) => part.trim()).filter(Boolean).join("\n\n"))
    .catch((error: unknown) => {
      // Keep successful and pending reads cached, but allow a failed read to recover.
      cachedSkills.delete(phase);
      throw error;
    });

  cachedSkills.set(phase, loaded);
  return loaded;
}
