import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_DIRECTORY = path.resolve(
  process.env.ARIOSO_COMPOSER_SKILL ?? path.join("skills", "composer-skill"),
);

let cachedSkill: Promise<string> | undefined;

export function loadComposerSkill(): Promise<string> {
  cachedSkill ??= Promise.all([
    readFile(path.join(SKILL_DIRECTORY, "SKILL.md"), "utf8"),
    readFile(path.join(SKILL_DIRECTORY, "references", "lyria-prompting.md"), "utf8"),
  ]).then(([skill, reference]) => `${skill.trim()}\n\n${reference.trim()}`);

  return cachedSkill;
}
