import { Agent } from "@openai/agents";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  defaultRun: vi.fn(),
  providerOptions: vi.fn(),
  runnerOptions: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@openai/agents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@openai/agents")>(),
  OpenAIProvider: class {
    constructor(options: unknown) { mocks.providerOptions(options); }
    close = mocks.close;
  },
  Runner: class {
    constructor(options: unknown) { mocks.runnerOptions(options); }
    run = mocks.run;
  },
  run: mocks.defaultRun,
}));

import { runComposerAgent } from "../src/composer/agent-runner.js";

const agent = new Agent({ name: "Test composer" });
const missingOutputMessage = "The agent returned no output.";

describe("composer agent execution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.defaultRun.mockResolvedValue({ finalOutput: "Music prompt" });
    mocks.run.mockResolvedValue({ finalOutput: "Music prompt" });
    mocks.close.mockResolvedValue(undefined);
  });

  it("uses the SDK default runner when no API key is supplied", async () => {
    await expect(runComposerAgent(agent, "brief", missingOutputMessage))
      .resolves.toBe("Music prompt");
    expect(mocks.defaultRun).toHaveBeenCalledWith(agent, "brief");
    expect(mocks.providerOptions).not.toHaveBeenCalled();
  });

  it("closes the explicit provider after a successful run", async () => {
    await expect(runComposerAgent(agent, "brief", missingOutputMessage, "test-key"))
      .resolves.toBe("Music prompt");
    expect(mocks.providerOptions).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(mocks.runnerOptions).toHaveBeenCalledWith({
      modelProvider: expect.objectContaining({ close: mocks.close }),
      tracing: { apiKey: "test-key" },
    });
    expect(mocks.run).toHaveBeenCalledWith(agent, "brief");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("preserves the execution failure when provider cleanup also fails", async () => {
    const executionError = new Error("Request failed");
    mocks.run.mockRejectedValue(executionError);
    mocks.close.mockRejectedValue(new Error("Cleanup failed"));

    await expect(runComposerAgent(agent, "brief", missingOutputMessage, "test-key"))
      .rejects.toBe(executionError);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("reports cleanup failures after a successful run", async () => {
    const cleanupError = new Error("Cleanup failed");
    mocks.close.mockRejectedValue(cleanupError);

    await expect(runComposerAgent(agent, "brief", missingOutputMessage, "test-key"))
      .rejects.toBe(cleanupError);
  });

  it("reports missing output and closes the provider", async () => {
    mocks.run.mockResolvedValue({ finalOutput: undefined });

    await expect(runComposerAgent(agent, "brief", missingOutputMessage, "test-key"))
      .rejects.toThrow(missingOutputMessage);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
