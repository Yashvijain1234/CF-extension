import { formatDuration } from '@/hooks/useTimer';

export function TimerWidget({ display, running, onToggle, onReset }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-cf-border bg-cf-surface px-2 py-1">
      <span className="font-mono text-sm tabular-nums text-cf-text">
        {formatDuration(display)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        title={running ? 'Pause' : 'Start'}
        className="text-cf-muted transition hover:text-cf-text"
      >
        {running ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        onClick={onReset}
        title="Reset"
        className="text-cf-muted transition hover:text-cf-text"
      >
        ↺
      </button>
    </div>
  );
}
