import { parse } from "dotenv";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const SUPPORTED_LANGUAGES = ["zh-CN", "en"] as const;
export type InterfaceLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ApiProvider = "openai" | "gemini";

const DEFAULT_LANGUAGE: InterfaceLanguage = "zh-CN";
const CREDENTIAL_NAMES: Record<ApiProvider, "OPENAI_API_KEY" | "GEMINI_API_KEY"> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

export interface CredentialSummary {
  configured: boolean;
  masked: string | null;
}

export interface SettingsSnapshot {
  language: InterfaceLanguage;
  credentials: Record<ApiProvider, CredentialSummary>;
}

export interface SettingsStoreOptions {
  preferencesPath: string;
  envPath: string;
  environment?: NodeJS.ProcessEnv;
}

function isLanguage(value: unknown): value is InterfaceLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as InterfaceLanguage);
}

function maskApiKey(value: string): string {
  const suffix = value.length >= 4 ? value.slice(-4) : "••••";
  return `••••${suffix}`;
}

function escapeDotEnv(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function readDotEnv(envPath: string): Promise<Record<string, string>> {
  try {
    return parse(await readFile(envPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function updateDotEnvValue(
  envPath: string,
  name: string,
  value: string | null,
): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const assignment = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  const output: string[] = [];
  let replaced = false;

  const lines = existing ? existing.split(/\r?\n/) : [];
  for (const line of lines) {
    if (assignment.test(line)) {
      if (value && !replaced) {
        output.push(`${name}="${escapeDotEnv(value)}"`);
        replaced = true;
      }
      continue;
    }
    output.push(line);
  }

  if (value && !replaced) {
    output.push(`${name}="${escapeDotEnv(value)}"`);
  }

  const content = output.join("\n").trimEnd();
  await atomicWrite(envPath, content ? `${content}\n` : "");
}

export class SettingsStore {
  readonly #preferencesPath: string;
  readonly #envPath: string;
  readonly #environment: NodeJS.ProcessEnv;
  readonly #sessionCredentials = new Map<ApiProvider, string>();

  constructor(options: SettingsStoreOptions) {
    this.#preferencesPath = options.preferencesPath;
    this.#envPath = options.envPath;
    this.#environment = options.environment ?? process.env;
  }

  async language(): Promise<InterfaceLanguage> {
    try {
      const value = JSON.parse(await readFile(this.#preferencesPath, "utf8")) as {
        language?: unknown;
      };
      return isLanguage(value.language) ? value.language : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  async saveLanguage(language: InterfaceLanguage): Promise<void> {
    if (!isLanguage(language)) {
      throw new Error(`Unsupported interface language: ${String(language)}`);
    }
    await atomicWrite(
      this.#preferencesPath,
      `${JSON.stringify({ language }, null, 2)}\n`,
    );
  }

  async resolveCredential(provider: ApiProvider): Promise<string | undefined> {
    const sessionValue = this.#sessionCredentials.get(provider)?.trim();
    if (sessionValue) {
      return sessionValue;
    }

    const name = CREDENTIAL_NAMES[provider];
    const localValue = (await readDotEnv(this.#envPath))[name]?.trim();
    if (localValue) {
      return localValue;
    }

    const environmentValue = this.#environment[name]?.trim();
    return environmentValue || undefined;
  }

  async saveCredential(provider: ApiProvider, value: string, remember: boolean): Promise<void> {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("API key is required.");
    }
    if (/[\r\n]/.test(normalized)) {
      throw new Error("API keys cannot contain line breaks.");
    }

    if (remember) {
      await updateDotEnvValue(this.#envPath, CREDENTIAL_NAMES[provider], normalized);
    }
    this.#sessionCredentials.set(provider, normalized);
  }

  async clearCredential(provider: ApiProvider): Promise<void> {
    this.#sessionCredentials.delete(provider);
    await updateDotEnvValue(this.#envPath, CREDENTIAL_NAMES[provider], null);
  }

  async runtimeEnvironment(): Promise<NodeJS.ProcessEnv> {
    const local = await readDotEnv(this.#envPath);
    const environment: NodeJS.ProcessEnv = { ...local, ...this.#environment };

    for (const provider of Object.keys(CREDENTIAL_NAMES) as ApiProvider[]) {
      const value = await this.resolveCredential(provider);
      const name = CREDENTIAL_NAMES[provider];
      if (value) {
        environment[name] = value;
      } else {
        delete environment[name];
      }
    }
    return environment;
  }

  async snapshot(): Promise<SettingsSnapshot> {
    const [language, openai, gemini] = await Promise.all([
      this.language(),
      this.resolveCredential("openai"),
      this.resolveCredential("gemini"),
    ]);
    return {
      language,
      credentials: {
        openai: { configured: Boolean(openai), masked: openai ? maskApiKey(openai) : null },
        gemini: { configured: Boolean(gemini), masked: gemini ? maskApiKey(gemini) : null },
      },
    };
  }
}
