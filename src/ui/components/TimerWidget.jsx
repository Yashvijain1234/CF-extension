import { Play, Pause, RotateCcw, Timer } from 'lucide-react';
import { formatDuration } from '@/hooks/useTimer';

export function TimerWidget({ display, running, onToggle, onReset }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-cf-border bg-cf-surface px-2 py-1">
      <Timer size={14} className="text-cf-muted" />
      <span className="min-w-[52px] font-mono text-sm tabular-nums text-cf-text">
        {formatDuration(display)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        title={running ? 'Pause' : 'Start'}
        className="flex h-6 w-6 items-center justify-center rounded text-cf-muted transition hover:bg-cf-surface-2 hover:text-cf-text"
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        onClick={onReset}
        title="Reset"
        className="flex h-6 w-6 items-center justify-center rounded text-cf-muted transition hover:bg-cf-surface-2 hover:text-cf-text"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
