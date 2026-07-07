import { IconButton } from './common';

/** Solved / Revision / Favorite / Starred toggles. */
export function ProgressControls({ progress, onChange }) {
  const cycleStatus = () => {
    const order = ['none', 'solved', 'revision'];
    const next = order[(order.indexOf(progress.status) + 1) % order.length];
    onChange({ status: next });
  };

  const statusLabel =
    progress.status === 'solved'
      ? '✅ Solved'
      : progress.status === 'revision'
        ? '🔁 Revision'
        : '⬜ Mark';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={cycleStatus}
        title="Cycle solved status"
        className="rounded-md border border-cf-border px-2.5 py-1 text-xs font-medium text-cf-text transition hover:bg-cf-surface-2"
      >
        {statusLabel}
      </button>
      <IconButton
        title="Favorite"
        active={progress.favorite}
        onClick={() => onChange({ favorite: !progress.favorite })}
      >
        {progress.favorite ? '❤️' : '🤍'}
      </IconButton>
      <IconButton
        title="Star"
        active={progress.starred}
        onClick={() => onChange({ starred: !progress.starred })}
      >
        {progress.starred ? '⭐' : '☆'}
      </IconButton>
    </div>
  );
}
