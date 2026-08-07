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

/**
 * Web research is OFF by default and opt-in: when enabled, search queries
 * go to the chosen search provider and requested pages are fetched — the
 * only network calls Otto makes beyond the model endpoint, and only when
 * the user asks for research.
 */
export const researchConfigSchema = z.object({
  provider: z.enum(['none', 'brave']),
  apiKey: z.string().optional(),
});
export type ResearchConfig = z.infer<typeof researchConfigSchema>;

export const DEFAULT_RESEARCH_CONFIG: ResearchConfig = { provider: 'none' };

const configFileSchema = z.object({
  llm: llmConfigSchema.partial().optional(),
  research: researchConfigSchema.partial().optional(),
});
type ConfigFile = z.infer<typeof configFileSchema>;

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

const RESEARCH_ENV_VARS = {
  provider: 'OTTO_SEARCH_PROVIDER',
  apiKey: 'OTTO_SEARCH_API_KEY',
} as const;

function readConfigFile(): ConfigFile {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const parsed = configFileSchema.safeParse(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  if (!parsed.success) {
    console.warn(`otto: ignoring malformed ${CONFIG_PATH}`);
    return {};
  }
  return parsed.data;
}

function writeConfigFile(next: ConfigFile): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`);
}

/** Effective LLM config: defaults ← config file ← env vars, per field. */
export function readLLMConfig(): LLMConfig {
  const file = readConfigFile().llm ?? {};
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

/** Effective research config: defaults ← config file ← env vars, per field. */
export function readResearchConfig(): ResearchConfig {
  const file = readConfigFile().research ?? {};
  const merged = {
    provider: process.env[RESEARCH_ENV_VARS.provider] ?? file.provider ?? DEFAULT_RESEARCH_CONFIG.provider,
    apiKey: process.env[RESEARCH_ENV_VARS.apiKey] ?? file.apiKey,
  };
  const parsed = researchConfigSchema.safeParse(merged);
  if (!parsed.success) {
    console.warn('otto: invalid research config, research stays off');
    return { ...DEFAULT_RESEARCH_CONFIG };
  }
  return parsed.data;
}

/**
 * Persist LLM settings to data/config.json, preserving every other section.
 * `apiKey: undefined` keeps any previously saved key; an empty string clears it.
 */
export function writeLLMConfig(changes: Partial<LLMConfig>): void {
  const file = readConfigFile();
  const next: Partial<LLMConfig> = { ...file.llm, ...changes };
  if (next.apiKey === '') {
    delete next.apiKey;
  }
  writeConfigFile({ ...file, llm: next });
}

/** Persist research settings, preserving every other section. Same key semantics as above. */
export function writeResearchConfig(changes: Partial<ResearchConfig>): void {
  const file = readConfigFile();
  const next: Partial<ResearchConfig> = { ...file.research, ...changes };
  if (next.apiKey === '') {
    delete next.apiKey;
  }
  writeConfigFile({ ...file, research: next });
}

/** Which fields are currently pinned by environment variables (shown in Settings). */
export function envOverriddenFields(): string[] {
  return Object.entries(ENV_VARS)
    .filter(([, envVar]) => process.env[envVar] !== undefined)
    .map(([field]) => field);
}

export function researchEnvOverriddenFields(): string[] {
  return Object.entries(RESEARCH_ENV_VARS)
    .filter(([, envVar]) => process.env[envVar] !== undefined)
    .map(([field]) => field);
}
