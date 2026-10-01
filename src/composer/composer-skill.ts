import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_DIRECTORY = path.resolve(
  process.env.ARIOSO_COMPOSER_SKILL ?? path.join("skills", "composer-skill"),
);

export type ComposerSkillMode = "single" | "orchestral";

const cachedSkills = new Map<ComposerSkillMode, Promise<string>>();

export function loadComposerSkill(mode: ComposerSkillMode = "single"): Promise<string> {
  const cached = cachedSkills.get(mode);
  if (cached) return cached;

  const loaded = Promise.all([
    readFile(path.join(SKILL_DIRECTORY, "SKILL.md"), "utf8"),
    readFile(path.join(SKILL_DIRECTORY, "references", "lyria-prompting.md"), "utf8"),
    mode === "orchestral"
      ? readFile(path.join(SKILL_DIRECTORY, "references", "orchestral-workflow.md"), "utf8")
      : Promise.resolve(""),
  ]).then((parts) => parts.map((part) => part.trim()).filter(Boolean).join("\n\n"));

  cachedSkills.set(mode, loaded);
  return loaded;
}
