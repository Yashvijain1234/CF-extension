import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { LANGUAGE_LIST } from '@/api/languages';
import {
  connectWithToken,
  connectWithOAuth,
  disconnect,
  getRepos,
  createRepository,
} from '@/github/service';
import { Button, Spinner } from '@/ui/components/common';

export function Options() {
  const { settings, update } = useSettings();

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text cf-lm-dark">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold">
          <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
            ⚡ Codeforces LeetMode
          </span>
        </h1>
        <p className="mb-8 text-sm text-cf-muted">Settings</p>

        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme">
            <Select
              value={settings.theme}
              options={[
                ['auto', 'Auto (match Codeforces)'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ]}
              onChange={(v) => update({ theme: v })}
            />
          </Row>
          <Row label="Font size">
            <input
              type="range"
              min={10}
              max={24}
              value={settings.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />

            <span className="ml-2 w-8 text-sm text-cf-muted">{settings.fontSize}</span>
          </Row>
          <Row label="Animations">
            <Toggle
              checked={settings.animations}
              onChange={(v) => update({ animations: v })}
            />
          </Row>
        </Section>

        {/* Editor */}
        <Section title="Editor">
          <Row label="Default language">
            <Select
              value={settings.defaultLanguage}
              options={LANGUAGE_LIST.map((l) => [l.id, l.label])}
              onChange={(v) => update({ defaultLanguage: v })}
            />
          </Row>
          <Row label="Editor theme">
            <Select
              value={settings.editorTheme}
              options={[
                ['vs-dark', 'Dark'],
                ['light', 'Light'],
                ['hc-black', 'High contrast'],
              ]}
              onChange={(v) => update({ editorTheme: v })}
            />
          </Row>
          <Row label="Word wrap">
            <Toggle
              checked={settings.wordWrap}
              onChange={(v) => update({ wordWrap: v })}
            />
          </Row>
          <Row label="Minimap">
            <Toggle checked={settings.minimap} onChange={(v) => update({ minimap: v })} />
          </Row>
          <Row label="Auto-save code & notes">
            <Toggle
              checked={settings.autoSave}
              onChange={(v) => update({ autoSave: v })}
            />
          </Row>
          <Row label="Auto-start timer">
            <Toggle
              checked={settings.timerAutoStart}
              onChange={(v) => update({ timerAutoStart: v })}
            />
          </Row>
        </Section>

        <GitHubSection />
        <AISection />

        <p className="mt-8 text-center text-xs text-cf-muted">
          Codeforces LeetMode · All data stored locally in your browser.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */

function GitHubSection() {
  const { settings, update } = useSettings();
  const gh = settings.github;
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [repos, setRepos] = useState([]);
  const [newRepo, setNewRepo] = useState('');

  useEffect(() => {
    if (gh.connected) {
      getRepos()
        .then((r) => setRepos(r.map((x) => x.full_name)))
        .catch(() => setRepos([]));
    }
  }, [gh.connected]);

  const withBusy = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="GitHub Integration">
      {!gh.connected ? (
        <>
          <p className="mb-3 text-sm text-cf-muted">
            Connect GitHub to auto-push accepted solutions (LeetHub-style). Use a
            fine-grained Personal Access Token with <b>Contents: read/write</b>{' '}
            permission, or OAuth if configured.
          </p>
          <Row label="Access token">
            <input
              type="password"
              value={token}
              placeholder="ghp_…"
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
            />
          </Row>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={busy || !token}
              onClick={() =>
                withBusy(async () => {
                  await connectWithToken(token.trim());
                  setToken('');
                })
              }
            >
              {busy ? <Spinner /> : null} Connect with Token
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => withBusy(async () => void (await connectWithOAuth()))}
            >
              Connect with OAuth
            </Button>
          </div>
        </>
      ) : (
        <>
          <Row label="Account">
            <span className="text-sm font-semibold text-emerald-500">{gh.username}</span>
          </Row>
          <Row label="Repository">
            <Select
              value={gh.repo ?? ''}
              options={[['', 'Select a repository…'], ...repos.map((r) => [r, r])]}
              onChange={(v) => update({ github: { ...gh, repo: v || null } })}
            />
          </Row>
          <Row label="Create new repo">
            <div className="flex w-full gap-2">
              <input
                value={newRepo}
                placeholder="codeforces-solutions"
                onChange={(e) => setNewRepo(e.target.value)}
                className="flex-1 rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
              />

              <Button
                variant="secondary"
                disabled={busy || !newRepo}
                onClick={() =>
                  withBusy(async () => {
                    const repo = await createRepository(newRepo.trim(), true);
                    setRepos((r) => [repo.full_name, ...r]);
                    setNewRepo('');
                  })
                }
              >
                Create
              </Button>
            </div>
          </Row>
          <Row label="Branch">
            <input
              value={gh.branch}
              onChange={(e) => update({ github: { ...gh, branch: e.target.value } })}
              className="w-40 rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
            />
          </Row>
          <Row label="Auto-upload on accept">
            <Toggle
              checked={gh.autoUpload}
              onChange={(v) => update({ github: { ...gh, autoUpload: v } })}
            />
          </Row>
          <Row label="Accepted solutions only">
            <Toggle
              checked={gh.acceptedOnly}
              onChange={(v) => update({ github: { ...gh, acceptedOnly: v } })}
            />
          </Row>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => withBusy(async () => void (await disconnect()))}
          >
            Disconnect GitHub
          </Button>
        </>
      )}
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </Section>
  );
}

function AISection() {
  const { settings, update } = useSettings();
  const ai = settings.ai;
  return (
    <Section title="AI Hints">
      <Row label="Provider">
        <Select
          value={ai.provider}
          options={[
            ['none', 'Disabled'],
            ['openai', 'OpenAI'],
            ['anthropic', 'Anthropic'],
            ['gemini', 'Google Gemini'],
            ['custom', 'Custom (OpenAI-compatible)'],
          ]}
          onChange={(v) => update({ ai: { ...ai, provider: v } })}
        />
      </Row>
      {ai.provider !== 'none' && (
        <>
          <Row label="API key">
            <input
              type="password"
              value={ai.apiKey ?? ''}
              placeholder="sk-…"
              onChange={(e) => update({ ai: { ...ai, apiKey: e.target.value } })}
              className="w-full rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
            />
          </Row>
          <Row label="Model">
            <input
              value={ai.model}
              onChange={(e) => update({ ai: { ...ai, model: e.target.value } })}
              className="w-full rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
            />
          </Row>
          {(ai.provider === 'custom' || ai.provider === 'openai') && (
            <Row label="Base URL (optional)">
              <input
                value={ai.baseUrl ?? ''}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => update({ ai: { ...ai, baseUrl: e.target.value } })}
                className="w-full rounded-lg border border-cf-border bg-cf-surface px-2.5 py-1.5 text-sm outline-none"
              />
            </Row>
          )}
        </>
      )}
    </Section>
  );
}

/* -------- primitives -------- */

function Section({ title, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-cf-border bg-cf-surface p-5">
      <h2 className="mb-4 text-base font-bold text-cf-text">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="text-sm text-cf-text">{label}</label>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-cf-border bg-cf-bg px-2.5 py-1.5 text-sm text-cf-text outline-none"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? 'bg-cf-accent' : 'bg-cf-surface-2'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
