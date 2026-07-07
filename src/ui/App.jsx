import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES } from '@/api/languages';
import { useSettings } from '@/hooks/useSettings';
import { useProblemData } from '@/hooks/useProblemData';
import { useResolvedTheme } from '@/hooks/useTheme';
import { useTimer } from '@/hooks/useTimer';
import { useSubmission } from '@/hooks/useSubmission';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { sendToBackground } from '@/services/messaging';
import { ProblemPanel } from './components/ProblemPanel';
import { EditorPane } from './components/EditorPane';
import { TestRunner } from './components/TestRunner';
import { NotesPanel } from './components/NotesPanel';
import { AIPanel } from './components/AIPanel';
import { SubmissionsPanel } from './components/SubmissionsPanel';
import { VerdictBadge } from './components/VerdictBadge';
import { TimerWidget } from './components/TimerWidget';
import { GitHubPushModal } from './components/GitHubPushModal';
import { Button } from './components/common';

const TABS = [
  { id: 'code', label: 'Code', icon: '{ }' },
  { id: 'tests', label: 'Tests', icon: '▶' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'submissions', label: 'Submissions', icon: '📊' },
  { id: 'ai', label: 'AI', icon: '✨' },
];

export function App({ problem, hostTheme, rootEl, onClose }) {
  const { settings, update: updateSettings } = useSettings();
  const { data, loaded, update, flush } = useProblemData(problem.key);
  const theme = useResolvedTheme(settings.theme, hostTheme);

  const [language, setLanguage] = useState(settings.defaultLanguage);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('code');
  const [customInput, setCustomInput] = useState('');
  const [githubModal, setGithubModal] = useState(null);

  const { state: submission, submit } = useSubmission(problem);
  const initialized = useRef(false);

  // Initialize editor state from persisted data once loaded.
  useEffect(() => {
    if (!loaded || initialized.current) return;
    initialized.current = true;
    const lang = data.lastLanguage ?? settings.defaultLanguage;
    setLanguage(lang);
    setCode(data.code[lang] ?? LANGUAGES[lang].template);
  }, [loaded, data, settings.defaultLanguage]);

  // Apply theme class + font to the overlay root.
  useEffect(() => {
    if (!rootEl) return;
    rootEl.classList.toggle('cf-lm-dark', theme === 'dark');
    rootEl.classList.toggle('cf-lm-light', theme === 'light');
  }, [rootEl, theme]);

  const persistCode = useCallback(
    (lang, value) => {
      update((prev) => ({
        ...prev,
        lastLanguage: lang,
        code: { ...prev.code, [lang]: value },
      }));
    },
    [update],
  );

  const onCodeChange = useCallback(
    (value) => {
      setCode(value);
      if (settings.autoSave) persistCode(language, value);
    },
    [language, settings.autoSave, persistCode],
  );

  const onLanguageChange = useCallback(
    (lang) => {
      persistCode(language, code); // save current before switching
      setLanguage(lang);
      setCode(data.code[lang] ?? LANGUAGES[lang].template);
    },
    [language, code, data.code, persistCode],
  );

  const timer = useTimer(
    data.timer,
    (next) => update((prev) => ({ ...prev, timer: next })),
    settings.timerAutoStart,
  );

  const handleSubmit = useCallback(async () => {
    persistCode(language, code);
    setTab('code');
    const result = await submit(language, code);
    if (result.phase === 'done' && result.result?.verdict === 'ACCEPTED') {
      update((prev) => ({
        ...prev,
        progress: { ...prev.progress, status: 'solved', updatedAt: Date.now() },
      }));
      if (settings.github.connected && settings.github.repo) {
        if (settings.github.autoUpload) {
          void sendToBackground({
            type: 'GITHUB_PUSH_SOLUTION',
            payload: {
              problem,
              result: result.result,
              source: code,
              languageExt: LANGUAGES[language].ext,
              onDuplicate: 'update',
            },
          }).catch(() => {});
        } else {
          setGithubModal(result.result);
        }
      }
    }
  }, [language, code, submit, persistCode, update, settings.github, problem]);

  useKeyboardShortcuts(rootEl, {
    onSubmit: handleSubmit,
    onSave: () => flush(),
    onToggleNotes: () => setTab((t) => (t === 'notes' ? 'code' : 'notes')),
    onCustomInput: () => setTab('tests'),
  });

  const isSubmitting =
    submission.phase === 'submitting' || submission.phase === 'polling';

  const rightContent = useMemo(() => {
    switch (tab) {
      case 'tests':
        return (
          <TestRunner
            language={language}
            code={code}
            input={customInput}
            onInputChange={setCustomInput}
          />
        );
      case 'notes':
        return (
          <NotesPanel
            content={data.notes.content}
            onChange={(content) =>
              update((prev) => ({
                ...prev,
                notes: { content, updatedAt: Date.now() },
              }))
            }
          />
        );
      case 'submissions':
        return <SubmissionsPanel problem={problem} />;
      case 'ai':
        return (
          <AIPanel
            problem={problem}
            code={code}
            language={language}
            aiEnabled={settings.ai.provider !== 'none'}
          />
        );
      case 'code':
      default:
        return (
          <EditorPane
            language={language}
            code={code}
            fontSize={settings.fontSize}
            theme={settings.editorTheme}
            onCodeChange={onCodeChange}
            onLanguageChange={onLanguageChange}
            onFontSize={(size) => updateSettings({ fontSize: size })}
          />
        );
    }
  }, [
    tab,
    language,
    code,
    customInput,
    data.notes.content,
    problem,
    settings,
    onCodeChange,
    onLanguageChange,
    update,
    updateSettings,
  ]);

  return (
    <div className="fixed inset-0 z-[2147483500] flex flex-col bg-cf-bg text-cf-text animate-fade-in">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-cf-border bg-cf-surface px-4 py-2">
        <div className="flex items-center gap-2 font-bold">
          <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
            ⚡ Codeforces LeetMode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TimerWidget
            display={timer.display}
            running={timer.running}
            onToggle={timer.toggle}
            onReset={timer.reset}
          />

          <button
            type="button"
            title="Toggle theme"
            onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
            className="h-8 w-8 rounded-md border border-cf-border text-cf-muted hover:text-cf-text"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            title="Settings"
            onClick={() =>
              void sendToBackground({ type: 'OPEN_OPTIONS' }).catch(() => {})
            }
            className="h-8 w-8 rounded-md border border-cf-border text-cf-muted hover:text-cf-text"
          >
            ⚙
          </button>
          <button
            type="button"
            title="Close (back to Codeforces)"
            onClick={onClose}
            className="h-8 w-8 rounded-md border border-cf-border text-cf-muted hover:text-cf-text"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Split body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: problem */}
        <div className="min-h-0 w-full overflow-hidden border-cf-border md:w-[46%] md:border-r">
          <ProblemPanel
            problem={problem}
            progress={data.progress}
            onProgressChange={(patch) =>
              update((prev) => ({
                ...prev,
                progress: { ...prev.progress, ...patch, updatedAt: Date.now() },
              }))
            }
            onUseSample={(input) => {
              setCustomInput(input);
              setTab('tests');
            }}
          />
        </div>

        {/* Right: editor + tabs + submit bar */}
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-cf-border bg-cf-surface px-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? 'border-cf-accent text-cf-text'
                    : 'border-transparent text-cf-muted hover:text-cf-text'
                }`}
              >
                <span className="text-xs">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">{rightContent}</div>

          {/* Submit bar */}
          <div className="border-t border-cf-border bg-cf-surface p-3">
            {(submission.result || submission.error) && (
              <div className="mb-2">
                {submission.result && <VerdictBadge result={submission.result} />}
                {submission.error && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-sm text-rose-400">
                    {submission.error}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-cf-muted">
                Ctrl+Enter Submit · Ctrl+S Save · Ctrl+B Notes · Ctrl+J Input
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setTab('tests')}>
                  ▶ Run
                </Button>
                <Button variant="success" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting
                    ? submission.phase === 'submitting'
                      ? 'Submitting…'
                      : 'Judging…'
                    : '⬆ Submit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {githubModal && (
        <GitHubPushModal
          problem={problem}
          result={githubModal}
          source={code}
          language={language}
          repo={settings.github.repo}
          onClose={() => setGithubModal(null)}
          onAlwaysPush={() =>
            updateSettings({ github: { ...settings.github, autoUpload: true } })
          }
        />
      )}
    </div>
  );
}
