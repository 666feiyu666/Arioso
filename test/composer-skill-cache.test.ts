import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));

describe("composer skill cache", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.readFile.mockReset();
    mocks.readFile.mockResolvedValue(" Prompting guidance. ");
  });

  it("shares pending and successful reads for the same mode", async () => {
    const { loadComposerSkill } = await import("../src/composer/composer-skill.js");
    const pending = loadComposerSkill();
    expect(loadComposerSkill()).toBe(pending);
    await expect(pending).resolves.toBe("Prompting guidance.\n\nPrompting guidance.");
    expect(loadComposerSkill()).toBe(pending);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
  });

  it("allows a failed load to be retried", async () => {
    const readError = new Error("Temporary read failure");
    mocks.readFile.mockRejectedValueOnce(readError);
    const { loadComposerSkill } = await import("../src/composer/composer-skill.js");

    await expect(loadComposerSkill()).rejects.toBe(readError);
    await expect(loadComposerSkill()).resolves.toBe("Prompting guidance.\n\nPrompting guidance.");
    expect(mocks.readFile).toHaveBeenCalledTimes(4);
  });
});
