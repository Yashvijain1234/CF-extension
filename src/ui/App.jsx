import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, CheckCircle2, History, StickyNote, Sparkles } from 'lucide-react';
import { LANGUAGES } from '@/api/languages';
import {
  ratingToDifficulty,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
} from '@/services/difficulty';
import { useSettings } from '@/hooks/useSettings';
import { useProblemData } from '@/hooks/useProblemData';
import { useLayout } from '@/hooks/useLayout';
import { useResolvedTheme } from '@/hooks/useTheme';
import { useTimer } from '@/hooks/useTimer';
import { useSubmission } from '@/hooks/useSubmission';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { sendToBackground } from '@/services/messaging';
import { getHandle, runCustomTest } from '@/services/pageBridge';
import { Header } from './components/Header';
import { SplitPane } from './components/SplitPane';
import { ProblemPanel } from './components/ProblemPanel';
import { EditorPane } from './components/EditorPane';
import { TestRunner } from './components/TestRunner';
import { NotesPanel } from './components/NotesPanel';
import { AIPanel } from './components/AIPanel';
import { SubmissionsPanel } from './components/SubmissionsPanel';
import { VerdictBadge } from './components/VerdictBadge';
import { GitHubPushModal } from './components/GitHubPushModal';

const BOTTOM_TABS = [
  { id: 'tests', label: 'Testcase', Icon: FlaskConical },
  { id: 'result', label: 'Result', Icon: CheckCircle2 },
  { id: 'submissions', label: 'Submissions', Icon: History },
  { id: 'notes', label: 'Notes', Icon: StickyNote },
  { id: 'ai', label: 'AI', Icon: Sparkles },
];

export function App({ problem, hostTheme, rootEl, onClose }) {
  const { settings, update: updateSettings } = useSettings();
  const { data, loaded, update, flush } = useProblemData(problem.key);
  const { layout, commit: commitLayout } = useLayout();
  const theme = useResolvedTheme(settings.theme, hostTheme);

  const [language, setLanguage] = useState(settings.defaultLanguage);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('tests');
  const [customInput, setCustomInput] = useState('');
  const [runState, setRunState] = useState({ status: 'idle' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [githubModal, setGithubModal] = useState(null);
  const [pushToast, setPushToast] = useState(null);
  const [handle, setHandleState] = useState(null);

  const { state: submission, submit } = useSubmission(problem);
  const initialized = useRef(false);

  const difficulty = ratingToDifficulty(problem.rating);
  const difficultyMeta = {
    label: DIFFICULTY_LABEL[difficulty] + (problem.rating ? ` · ${problem.rating}` : ''),
    color: DIFFICULTY_COLOR[difficulty],
  };

  // Fetch the logged-in Codeforces handle (for the profile chip) once.
  useEffect(() => {
    getHandle()
      .then((h) => setHandleState(h))
      .catch(() => setHandleState(null));
  }, []);

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
      persistCode(language, code);
      setLanguage(lang);
      setCode(data.code[lang] ?? LANGUAGES[lang].template);
    },
    [language, code, data.code, persistCode],
  );

  const resetCode = useCallback(() => {
    const template = LANGUAGES[language].template;
    setCode(template);
    persistCode(language, template);
  }, [language, persistCode]);

  const timer = useTimer(
    data.timer,
    (next) => update((prev) => ({ ...prev, timer: next })),
    settings.timerAutoStart,
  );

  const toggleTheme = useCallback(
    () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }),
    [theme, updateSettings],
  );

  const runCode = useCallback(async () => {
    if (!code.trim()) {
      setRunState({ status: 'error', error: 'Source code is empty.' });
      setTab('tests');
      return;
    }
    persistCode(language, code);
    setTab('tests');
    setRunState({ status: 'running' });
    try {
      const result = await runCustomTest({
        source: code,
        languageId: LANGUAGES[language].cfId,
        input: customInput,
      });
      setRunState({ status: 'done', result });
    } catch (e) {
      setRunState({
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [code, language, customInput, persistCode]);

  const handleSubmit = useCallback(async () => {
    persistCode(language, code);
    setTab('result');
    const result = await submit(language, code);
    if (result.phase === 'done' && result.result?.verdict === 'ACCEPTED') {
      update((prev) => ({
        ...prev,
        progress: { ...prev.progress, status: 'solved', updatedAt: Date.now() },
      }));
      if (settings.github.connected && settings.github.repo) {
        if (settings.github.autoUpload) {
          setPushToast({ status: 'pushing', message: 'Pushing solution to GitHub…' });
          try {
            const res = await sendToBackground({
              type: 'GITHUB_PUSH_SOLUTION',
              payload: {
                problem,
                result: result.result,
                source: code,
                languageExt: LANGUAGES[language].ext,
                onDuplicate: 'update',
              },
            });
            setPushToast({
              status: 'done',
              message: `${res.action === 'skipped' ? 'Skipped' : 'Pushed'} → ${res.solutionUrl}`,
              url: res.solutionUrl,
            });
          } catch (e) {
            setPushToast({
              status: 'error',
              message: `GitHub push failed: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        } else {
          setGithubModal(result.result);
        }
      } else if (settings.github.connected && !settings.github.repo) {
        setPushToast({
          status: 'error',
          message: 'GitHub is connected but no repository is selected. Pick one in Settings.',
        });
      }
    }
  }, [language, code, submit, persistCode, update, settings.github, problem]);

  const handleGithub = useCallback(() => {
    if (!settings.github.connected) {
      void sendToBackground({ type: 'OPEN_OPTIONS' }).catch(() => {});
      return;
    }
    persistCode(language, code);
    setGithubModal(
      submission.result ?? {
        verdict: submission.result?.verdict ?? 'UNKNOWN',
        timeConsumedMs: 0,
        memoryConsumedKb: 0,
        passedTestCount: 0,
        id: null,
      },
    );
  }, [settings.github.connected, submission.result, persistCode, language, code]);

  useKeyboardShortcuts(rootEl, {
    onSubmit: handleSubmit,
    onSave: () => flush(),
    onToggleSidebar: () => setSidebarOpen((o) => !o),
    onToggleTests: () => setTab((t) => (t === 'tests' ? 'result' : 'tests')),
    onToggleTheme: toggleTheme,
  });

  const isSubmitting =
    submission.phase === 'submitting' || submission.phase === 'polling';

  const bottomContent = useMemo(() => {
    switch (tab) {
      case 'result': {
        const pending =
          submission.phase === 'submitting' || submission.phase === 'polling';
        // Live progress text streamed from the background submission flow.
        const pendingLabel =
          submission.message ??
          (submission.phase === 'submitting'
            ? 'Sending your submission to Codeforces…'
            : 'In queue — waiting for the judge…');
        return (
          <div className="h-full overflow-y-auto p-4">
            {submission.result ? (
              <VerdictBadge result={submission.result} />
            ) : pending ? (
              <div className="flex items-center gap-3 rounded-xl border border-cf-border bg-cf-surface p-3 text-sm text-cf-text">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cf-border border-t-cf-accent" />
                {pendingLabel}
              </div>
            ) : submission.error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-400">
                {submission.error}
              </div>
            ) : (
              <p className="text-sm text-cf-muted">
                No submission yet. Press <b>Submit</b> (Ctrl+Enter) to judge your
                solution.
              </p>
            )}
          </div>
        );
      }
      case 'submissions':
        return <SubmissionsPanel problem={problem} />;
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
      case 'ai':
        return (
          <AIPanel
            problem={problem}
            code={code}
            language={language}
            aiEnabled={settings.ai.provider !== 'none'}
          />
        );
      case 'tests':
      default:
        return (
          <TestRunner
            input={customInput}
            onInputChange={setCustomInput}
            runState={runState}
            onRun={runCode}
          />
        );
    }
  }, [
    tab,
    submission,
    problem,
    data.notes.content,
    code,
    language,
    customInput,
    runState,
    runCode,
    settings.ai.provider,
    update,
  ]);

  const editorPane = (
    <EditorPane
      language={language}
      code={code}
      fontSize={settings.fontSize}
      theme={settings.editorTheme}
      wordWrap={settings.wordWrap}
      minimap={settings.minimap}
      onCodeChange={onCodeChange}
      onFontSize={(size) => updateSettings({ fontSize: size })}
      onToggleWrap={() => updateSettings({ wordWrap: !settings.wordWrap })}
      onToggleMinimap={() => updateSettings({ minimap: !settings.minimap })}
      onReset={resetCode}
    />
  );

  const bottomPanel = (
    <div className="flex h-full flex-col bg-cf-bg">
      <div className="flex items-center gap-1 border-b border-cf-border bg-cf-surface px-2">
        {BOTTOM_TABS.map((t) => {
          const active = tab === t.id;
          const showDot = t.id === 'result' && (submission.result || submission.error);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'border-cf-accent text-cf-text'
                  : 'border-transparent text-cf-muted hover:text-cf-text'
              }`}
            >
              <t.Icon size={14} />
              {t.label}
              {showDot && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-cf-accent" />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={settings.animations ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={settings.animations ? { opacity: 0, y: -6 } : undefined}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {bottomContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  const rightColumn = (
    <SplitPane
      orientation="vertical"
      size={100 - layout.bottomHeight}
      min={25}
      max={85}
      onCommit={(v) => commitLayout({ bottomHeight: Math.round(100 - v) })}
      first={editorPane}
      second={bottomPanel}
    />
  );

  const problemPane = (
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
  );

  return (
    <div className="fixed inset-0 z-[2147483500] flex flex-col bg-cf-bg text-cf-text">
      <Header
        problem={problem}
        difficulty={difficultyMeta}
        timer={timer}
        language={language}
        onLanguageChange={onLanguageChange}
        onRun={runCode}
        isRunning={runState.status === 'running'}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submissionPhase={submission.phase}
        onGithub={handleGithub}
        githubConnected={settings.github.connected}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() =>
          void sendToBackground({ type: 'OPEN_OPTIONS' }).catch(() => {})
        }
        onClose={onClose}
        handle={handle}
      />

      <div className="min-h-0 flex-1">
        {sidebarOpen ? (
          <SplitPane
            orientation="horizontal"
            size={layout.leftWidth}
            min={20}
            max={70}
            onCommit={(v) => commitLayout({ leftWidth: Math.round(v) })}
            first={problemPane}
            second={rightColumn}
          />
        ) : (
          rightColumn
        )}
      </div>

      {pushToast && (
        <div className="fixed bottom-4 right-4 z-[2147483600] max-w-sm">
          <div
            className={`flex items-start gap-2 rounded-xl border p-3 text-sm shadow-lg ${
              pushToast.status === 'error'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                : pushToast.status === 'done'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-cf-border bg-cf-surface text-cf-text'
            }`}
          >
            {pushToast.status === 'pushing' && (
              <span className="mt-0.5 h-4 w-4 flex-none animate-spin rounded-full border-2 border-cf-border border-t-cf-accent" />
            )}
            <div className="min-w-0 flex-1 break-words">
              {pushToast.url ? (
                <a
                  href={pushToast.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {pushToast.message}
                </a>
              ) : (
                pushToast.message
              )}
            </div>
            <button
              type="button"
              onClick={() => setPushToast(null)}
              className="flex-none text-current/70 transition hover:opacity-100"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
