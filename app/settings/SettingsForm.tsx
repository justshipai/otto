'use client';

import { useEffect, useState } from 'react';

interface SettingsData {
  provider: 'anthropic' | 'openai-compatible';
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  envOverrides: string[];
  research: {
    provider: 'none' | 'brave';
    hasApiKey: boolean;
    envOverrides: string[];
  };
}

const MODEL_PLACEHOLDERS: Record<SettingsData['provider'], string> = {
  anthropic: 'e.g. claude-sonnet-5',
  'openai-compatible': 'e.g. gpt-5.2 or llama3.3',
};

const BASE_URL_EXAMPLES =
  'OpenAI https://api.openai.com/v1 · Groq https://api.groq.com/openai/v1 · OpenRouter https://openrouter.ai/api/v1 · Ollama http://localhost:11434/v1 · LM Studio http://localhost:1234/v1';

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none';

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData | undefined>();
  const [apiKey, setApiKey] = useState('');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | undefined>();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | undefined>();

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setStatus({ kind: 'error', text: 'Could not load settings.' }));
  }, []);

  if (!settings) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }

  const overridden = (field: string) => settings.envOverrides.includes(field);

  async function save(): Promise<boolean> {
    setBusy('save');
    setStatus(undefined);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: settings!.provider,
          model: settings!.model,
          baseUrl: settings!.baseUrl,
          // empty string = keep the saved key (the form never displays it)
          ...(apiKey === '' ? {} : { apiKey }),
          research: {
            provider: settings!.research.provider,
            ...(searchApiKey === '' ? {} : { apiKey: searchApiKey }),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: 'error', text: data.error ?? 'Could not save.' });
        return false;
      }
      if (apiKey !== '') {
        setSettings((prev) => (prev ? { ...prev, hasApiKey: true } : prev));
        setApiKey('');
      }
      if (searchApiKey !== '') {
        setSettings((prev) =>
          prev ? { ...prev, research: { ...prev.research, hasApiKey: true } } : prev,
        );
        setSearchApiKey('');
      }
      setStatus({ kind: 'ok', text: 'Saved to data/config.json.' });
      return true;
    } catch {
      setStatus({ kind: 'error', text: 'Could not save.' });
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  async function saveAndTest() {
    const saved = await save();
    if (!saved) {
      return;
    }
    setBusy('test');
    setStatus({ kind: 'info', text: 'Talking to the model…' });
    try {
      const res = await fetch('/api/settings/test', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setStatus({
          kind: 'ok',
          text: `${data.model} replied${data.attempts > 1 ? ' (after one retry)' : ''}: “${data.message}”`,
        });
      } else {
        setStatus({ kind: 'error', text: data.error });
      }
    } catch {
      setStatus({ kind: 'error', text: 'Test request failed.' });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Provider</span>
        <select
          className={inputClass}
          value={settings.provider}
          disabled={overridden('provider')}
          onChange={(e) =>
            setSettings({ ...settings, provider: e.target.value as SettingsData['provider'] })
          }
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai-compatible">OpenAI-compatible (OpenAI, Groq, OpenRouter, Ollama, LM Studio…)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Model</span>
        <input
          className={inputClass}
          value={settings.model}
          disabled={overridden('model')}
          placeholder={MODEL_PLACEHOLDERS[settings.provider]}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
        />
      </label>

      {settings.provider === 'openai-compatible' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Base URL</span>
          <input
            className={inputClass}
            value={settings.baseUrl}
            disabled={overridden('baseUrl')}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          />
          <span className="text-xs leading-relaxed text-neutral-400">{BASE_URL_EXAMPLES}</span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">API key</span>
        <input
          className={inputClass}
          type="password"
          value={apiKey}
          disabled={overridden('apiKey')}
          placeholder={
            settings.hasApiKey ? 'saved — leave blank to keep, type to replace' : 'paste your key'
          }
          autoComplete="off"
          onChange={(e) => setApiKey(e.target.value)}
        />
        <span className="text-xs text-neutral-400">
          Stored only in data/config.json on this machine and sent only to the endpoint above.
          Local models via Ollama or LM Studio don&apos;t need one.
        </span>
      </label>

      {settings.envOverrides.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Set by environment variables and not editable here: {settings.envOverrides.join(', ')}
        </p>
      )}

      <div className="mt-2 border-t border-neutral-200 pt-5">
        <h2 className="text-base font-semibold">Web research</h2>
        <p className="mt-1 mb-4 text-xs leading-relaxed text-neutral-500">
          Off by default. When on, and only when you ask Otto to look something up, your search
          query goes to the provider below and Otto fetches the public pages it finds. Nothing else
          ever leaves your machine.
        </p>
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Search provider</span>
            <select
              className={inputClass}
              value={settings.research.provider}
              disabled={settings.research.envOverrides.includes('provider')}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  research: { ...settings.research, provider: e.target.value as 'none' | 'brave' },
                })
              }
            >
              <option value="none">Off — no web access</option>
              <option value="brave">Brave Search</option>
            </select>
          </label>
          {settings.research.provider !== 'none' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Search API key</span>
              <input
                className={inputClass}
                type="password"
                value={searchApiKey}
                disabled={settings.research.envOverrides.includes('apiKey')}
                placeholder={
                  settings.research.hasApiKey
                    ? 'saved — leave blank to keep, type to replace'
                    : 'paste your key (free tier at brave.com/search/api)'
                }
                autoComplete="off"
                onChange={(e) => setSearchApiKey(e.target.value)}
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          disabled={busy !== undefined}
          onClick={save}
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        <button
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          disabled={busy !== undefined}
          onClick={saveAndTest}
        >
          {busy === 'test' ? 'Testing…' : 'Save & test connection'}
        </button>
      </div>

      {status && (
        <p
          className={
            status.kind === 'ok'
              ? 'text-sm text-green-700'
              : status.kind === 'error'
                ? 'text-sm text-red-600'
                : 'text-sm text-neutral-500'
          }
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
