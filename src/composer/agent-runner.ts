import {
  type Agent,
  type AgentOutputType,
  OpenAIProvider,
  Runner,
  run,
} from "@openai/agents";

export async function runComposerAgent<TOutput extends AgentOutputType>(
  agent: Agent<unknown, TOutput>,
  input: string,
  missingOutputMessage: string,
  apiKey?: string,
): Promise<unknown> {
  const provider = apiKey ? new OpenAIProvider({ apiKey }) : undefined;
  let executionFailed = false;

  try {
    const result = provider && apiKey
      ? await new Runner({ modelProvider: provider, tracing: { apiKey } }).run(agent, input)
      : await run(agent, input);

    if (result.finalOutput === undefined) {
      throw new Error(missingOutputMessage);
    }
    return result.finalOutput;
  } catch (error) {
    executionFailed = true;
    throw error;
  } finally {
    try {
      await provider?.close();
    } catch (error) {
      // Resource cleanup must not replace the original execution error.
      if (!executionFailed) throw error;
    }
  }
}
