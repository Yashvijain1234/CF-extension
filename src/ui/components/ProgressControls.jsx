import { CheckCircle2, RotateCcw, Circle, Heart, Star, Target } from 'lucide-react';
import { IconButton } from './common';

/** Solved / Revision / Favorite / Starred / Needs-Practice toggles. */
export function ProgressControls({ progress, onChange }) {
  const cycleStatus = () => {
    const order = ['none', 'solved', 'revision'];
    const next = order[(order.indexOf(progress.status) + 1) % order.length];
    onChange({ status: next });
  };

  const status =
    progress.status === 'solved'
      ? { label: 'Solved', Icon: CheckCircle2, cls: 'text-emerald-500' }
      : progress.status === 'revision'
        ? { label: 'Revision', Icon: RotateCcw, cls: 'text-amber-500' }
        : { label: 'Mark', Icon: Circle, cls: 'text-cf-muted' };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={cycleStatus}
        title="Cycle solved status"
        className={`inline-flex items-center gap-1.5 rounded-md border border-cf-border px-2.5 py-1 text-xs font-medium transition hover:bg-cf-surface-2 ${status.cls}`}
      >
        <status.Icon size={14} />
        {status.label}
      </button>
      <IconButton
        title="Favorite"
        active={progress.favorite}
        onClick={() => onChange({ favorite: !progress.favorite })}
      >
        <Heart size={15} fill={progress.favorite ? 'currentColor' : 'none'} />
      </IconButton>
      <IconButton
        title="Star"
        active={progress.starred}
        onClick={() => onChange({ starred: !progress.starred })}
      >
        <Star size={15} fill={progress.starred ? 'currentColor' : 'none'} />
      </IconButton>
      <IconButton
        title="Needs practice"
        active={progress.needsPractice}
        onClick={() => onChange({ needsPractice: !progress.needsPractice })}
      >
        <Target size={15} />
      </IconButton>
    </div>
  );
}
