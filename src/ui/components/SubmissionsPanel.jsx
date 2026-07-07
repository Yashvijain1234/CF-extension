import { useEffect, useState } from 'react';
import { fetchProblemSubmissions } from '@/services/pageBridge';
import { verdictMeta } from './VerdictBadge';
import { Button, Spinner } from './common';

/** Previous submissions for the current problem, pulled from the CF API. */
export function SubmissionsPanel({ problem }) {
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [onlyAccepted, setOnlyAccepted] = useState(false);

  const load = async () => {
    if (!problem.contestId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProblemSubmissions(
        problem.contestId,
        problem.problemIndex,
      );
      setSubs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.key]);

  const shown = (subs ?? []).filter((s) => !onlyAccepted || s.verdict === 'ACCEPTED');

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-cf-muted">
          <input
            type="checkbox"
            checked={onlyAccepted}
            onChange={(e) => setOnlyAccepted(e.target.checked)}
          />
          Accepted only
        </label>
        <Button variant="secondary" onClick={load}>
          ↻ Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-cf-muted">
          <Spinner /> Loading…
        </div>
      )}
      {error && <div className="text-sm text-rose-500">{error}</div>}

      {!loading && shown.length === 0 && !error && (
        <p className="text-sm text-cf-muted">No submissions found.</p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((s) => {
          const meta = verdictMeta(s.verdict);
          return (
            <a
              key={s.id}
              href={`https://codeforces.com/contest/${problem.contestId}/submission/${s.id}`}
              target="_blank"
              rel="noreferrer"
              className="mb-2 flex items-center justify-between rounded-lg border border-cf-border bg-cf-surface px-3 py-2 transition hover:bg-cf-surface-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: meta.color }}>
                  {meta.icon} {meta.label}
                </span>
                <span className="text-xs text-cf-muted">
                  {new Date(s.creationTimeSeconds * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-end text-xs text-cf-muted">
                <span>{s.language}</span>
                <span>
                  {s.timeConsumedMs} ms · {(s.memoryConsumedKb / 1024).toFixed(1)} MB
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
