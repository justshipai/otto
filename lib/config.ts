import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Otto's local configuration: which LLM to talk to, with what key.
 *
 * Values live in data/config.json (gitignored, written by the Settings
 * screen) and never leave this machine — the API key is only ever sent to
 * the model endpoint the user configured. Environment variables override
 * the file per field, which is handy for scripts and for keeping keys out
 * of the file entirely if preferred (see .env.example).
 */

export const llmConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai-compatible']),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  // required by the openai-compatible adapter, unused by anthropic
  baseUrl: z.union([z.url(), z.literal('')]).optional(),
});
export type LLMConfig = z.infer<typeof llmConfigSchema>;

const configFileSchema = z.object({
  llm: llmConfigSchema.partial().optional(),
});

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
};

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

const ENV_VARS = {
  provider: 'OTTO_LLM_PROVIDER',
  model: 'OTTO_LLM_MODEL',
  apiKey: 'OTTO_LLM_API_KEY',
  baseUrl: 'OTTO_LLM_BASE_URL',
} as const;

function readConfigFile(): Partial<LLMConfig> {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const parsed = configFileSchema.safeParse(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  if (!parsed.success) {
    console.warn(`otto: ignoring malformed ${CONFIG_PATH}`);
    return {};
  }
  return parsed.data.llm ?? {};
}

/** Effective LLM config: defaults ← config file ← env vars, per field. */
export function readLLMConfig(): LLMConfig {
  const file = readConfigFile();
  const merged = {
    provider: process.env[ENV_VARS.provider] ?? file.provider ?? DEFAULT_LLM_CONFIG.provider,
    model: process.env[ENV_VARS.model] ?? file.model ?? DEFAULT_LLM_CONFIG.model,
    apiKey: process.env[ENV_VARS.apiKey] ?? file.apiKey,
    baseUrl: process.env[ENV_VARS.baseUrl] ?? file.baseUrl,
  };
  const parsed = llmConfigSchema.safeParse(merged);
  if (!parsed.success) {
    console.warn('otto: invalid LLM config, falling back to defaults');
    return { ...DEFAULT_LLM_CONFIG };
  }
  return parsed.data;
}

/**
 * Persist LLM settings to data/config.json. `apiKey: undefined` keeps any
 * previously saved key; an empty string clears it.
 */
export function writeLLMConfig(changes: Partial<LLMConfig>): void {
  const file = readConfigFile();
  const next: Partial<LLMConfig> = { ...file, ...changes };
  if (next.apiKey === '') {
    delete next.apiKey;
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify({ llm: next }, null, 2)}\n`);
}

/** Which fields are currently pinned by environment variables (shown in Settings). */
export function envOverriddenFields(): string[] {
  return Object.entries(ENV_VARS)
    .filter(([, envVar]) => process.env[envVar] !== undefined)
    .map(([field]) => field);
}
