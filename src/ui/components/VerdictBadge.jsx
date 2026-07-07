import { Spinner } from './common';

const VERDICT_META = {
  PENDING: { label: 'In Queue', color: '#8b949e', icon: '⏳' },
  TESTING: { label: 'Running', color: '#3b82f6', icon: '⚙️' },
  ACCEPTED: { label: 'Accepted', color: '#00b8a3', icon: '✅' },
  WRONG_ANSWER: { label: 'Wrong Answer', color: '#ff375f', icon: '❌' },
  RUNTIME_ERROR: { label: 'Runtime Error', color: '#ff8c00', icon: '💥' },
  TIME_LIMIT_EXCEEDED: { label: 'Time Limit Exceeded', color: '#ff8c00', icon: '⏱️' },
  MEMORY_LIMIT_EXCEEDED: { label: 'Memory Limit Exceeded', color: '#ff8c00', icon: '💾' },
  COMPILATION_ERROR: { label: 'Compilation Error', color: '#a855f7', icon: '🛠️' },
  IDLENESS_LIMIT_EXCEEDED: {
    label: 'Idleness Limit Exceeded',
    color: '#ff8c00',
    icon: '😴',
  },
  PARTIAL: { label: 'Partial', color: '#ffb800', icon: '➗' },
  CHALLENGED: { label: 'Hacked', color: '#ff375f', icon: '⚔️' },
  SKIPPED: { label: 'Skipped', color: '#8b949e', icon: '⏭️' },
  REJECTED: { label: 'Rejected', color: '#ff375f', icon: '🚫' },
  FAILED: { label: 'Failed', color: '#ff375f', icon: '❌' },
  UNKNOWN: { label: 'Unknown', color: '#8b949e', icon: '❔' },
};

export function verdictMeta(v) {
  return VERDICT_META[v] ?? VERDICT_META.UNKNOWN;
}

export function VerdictBadge({ result }) {
  const meta = verdictMeta(result.verdict);
  const inProgress = result.verdict === 'PENDING' || result.verdict === 'TESTING';
  return (
    <div
      className="animate-slide-up rounded-xl border p-3"
      style={{ borderColor: `${meta.color}55`, backgroundColor: `${meta.color}12` }}
    >
      <div className="flex items-center gap-2">
        {inProgress ? <Spinner /> : <span className="text-lg">{meta.icon}</span>}
        <span className="text-base font-bold" style={{ color: meta.color }}>
          {meta.label}
        </span>
        {result.verdict !== 'ACCEPTED' && result.passedTestCount > 0 && !inProgress && (
          <span className="text-xs text-cf-muted">
            on test {result.passedTestCount + 1}
          </span>
        )}
      </div>
      {!inProgress && result.verdict !== 'COMPILATION_ERROR' && (
        <div className="mt-2 flex gap-4 text-xs text-cf-muted">
          <span>⏱ {result.timeConsumedMs} ms</span>
          <span>💾 {(result.memoryConsumedKb / 1024).toFixed(1)} MB</span>
          {result.verdict === 'ACCEPTED' && <span>✓ {result.passedTestCount} tests</span>}
        </div>
      )}
    </div>
  );
}
