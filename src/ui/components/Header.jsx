import { motion } from 'framer-motion';
import {
  Zap,
  Play,
  Upload,
  GitBranch,
  Sun,
  Moon,
  Settings,
  X,
  User,
  ExternalLink,
} from 'lucide-react';
import { LANGUAGE_LIST } from '@/api/languages';
import { Badge } from './common';
import { TimerWidget } from './TimerWidget';

/**
 * Global application header: brand, problem identity + difficulty, and every
 * top-level action (timer, language, run, submit, GitHub sync, theme, settings,
 * profile, close). Problem-specific bookmarks stay in the problem pane.
 */
export function Header({
  problem,
  difficulty,
  timer,
  language,
  onLanguageChange,
  onRun,
  isRunning,
  onSubmit,
  isSubmitting,
  submissionPhase,
  onGithub,
  githubConnected,
  theme,
  onToggleTheme,
  onOpenSettings,
  onClose,
  handle,
}) {
  const submitLabel = !isSubmitting
    ? 'Submit'
    : submissionPhase === 'submitting'
      ? 'Submitting…'
      : submissionPhase === 'verifying'
        ? 'Finish on CF…'
        : 'Judging…';

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex items-center justify-between gap-3 border-b border-cf-border bg-cf-surface/90 px-3 py-2 backdrop-blur"
    >
      {/* Brand + problem identity */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm">
            <Zap size={16} fill="currentColor" />
          </span>
          <span className="hidden bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent sm:inline">
            LeetMode
          </span>
        </div>

        <div className="h-6 w-px bg-cf-border" />

        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-cf-text">
            <span className="text-cf-muted">
              {problem.contestId}
              {problem.problemIndex}.{' '}
            </span>
            {problem.title}
          </h1>
          <Badge color={difficulty.color}>{difficulty.label}</Badge>
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            title="Open original on Codeforces"
            className="hidden text-cf-muted transition hover:text-cf-text md:inline-flex"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-none items-center gap-2">
        <div className="hidden lg:block">
          <TimerWidget
            display={timer.display}
            running={timer.running}
            onToggle={timer.toggle}
            onReset={timer.reset}
          />
        </div>

        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          title="Language"
          className="rounded-lg border border-cf-border bg-cf-bg px-2 py-1.5 text-xs font-medium text-cf-text outline-none transition hover:border-cf-accent"
        >
          {LANGUAGE_LIST.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onRun}
          disabled={isRunning}
          title="Run on Codeforces custom test"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cf-border bg-cf-bg px-3 py-1.5 text-sm font-semibold text-cf-text transition hover:bg-cf-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play size={14} /> {isRunning ? 'Running…' : 'Run'}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onSubmit}
          disabled={isSubmitting}
          title="Submit to Codeforces (Ctrl+Enter)"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={14} /> {submitLabel}
        </motion.button>

        <div className="mx-0.5 h-6 w-px bg-cf-border" />

        <IconAction
          title={githubConnected ? 'Sync to GitHub' : 'Connect GitHub in Settings'}
          onClick={onGithub}
          active={githubConnected}
        >
          <GitBranch size={16} />
        </IconAction>
        <IconAction title="Toggle theme (Ctrl+Shift+L)" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconAction>
        <IconAction title="Settings" onClick={onOpenSettings}>
          <Settings size={16} />
        </IconAction>

        {handle ? (
          <a
            href={`https://codeforces.com/profile/${handle}`}
            target="_blank"
            rel="noreferrer"
            title={`Codeforces profile: ${handle}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cf-border bg-cf-bg px-2 py-1.5 text-xs font-medium text-cf-text transition hover:bg-cf-surface-2"
          >
            <User size={14} />
            <span className="hidden max-w-[90px] truncate xl:inline">{handle}</span>
          </a>
        ) : (
          <IconAction title="Not logged in to Codeforces">
            <User size={16} />
          </IconAction>
        )}

        <IconAction title="Close (back to Codeforces)" onClick={onClose}>
          <X size={16} />
        </IconAction>
      </div>
    </motion.header>
  );
}

function IconAction({ title, onClick, active, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-cf-border transition hover:bg-cf-surface-2 ${
        active ? 'text-cf-accent' : 'text-cf-muted hover:text-cf-text'
      }`}
    >
      {children}
    </button>
  );
}
