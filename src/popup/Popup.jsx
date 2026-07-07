import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { listProblemKeys, getProblemData } from '@/storage';
import { Button } from '@/ui/components/common';

export function Popup() {
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [onCfProblem, setOnCfProblem] = useState(false);

  useEffect(() => {
    (async () => {
      const keys = await listProblemKeys();
      const data = await Promise.all(
        keys.map(async (key) => ({ key, data: await getProblemData(key) })),
      );
      setRows(
        data
          .filter((r) => r.data.progress.status !== 'none' || r.data.progress.favorite)
          .sort((a, b) => b.data.progress.updatedAt - a.data.progress.updatedAt)
          .slice(0, 8),
      );
    })();
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setOnCfProblem(/codeforces\.com\/.*problem/.test(tab?.url ?? ''));
    });
  }, []);

  const solved = rows.filter((r) => r.data.progress.status === 'solved').length;

  return (
    <div className="w-full bg-cf-bg p-4 text-cf-text">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg font-bold">
          <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
            ⚡ Codeforces LeetMode
          </span>
        </span>
      </div>

      {onCfProblem ? (
        <p className="mb-3 rounded-lg border border-cf-border bg-cf-surface p-2.5 text-xs text-cf-muted">
          On a problem page — click the ✨ button (or press <b>Alt+O</b>) to open the
          Better UI.
        </p>
      ) : (
        <p className="mb-3 rounded-lg border border-cf-border bg-cf-surface p-2.5 text-xs text-cf-muted">
          Open any Codeforces problem to launch the Better UI.
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="Solved" value={solved} />
        <Stat
          label="Favorites"
          value={rows.filter((r) => r.data.progress.favorite).length}
        />
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-semibold text-cf-muted">Recent</div>
        {rows.length === 0 && (
          <p className="text-xs text-cf-muted">No tracked problems yet.</p>
        )}
        {rows.map((r) => (
          <div
            key={r.key}
            className="mb-1 flex items-center justify-between rounded-md border border-cf-border bg-cf-surface px-2.5 py-1.5 text-xs"
          >
            <span className="font-mono">{r.key}</span>
            <span className="text-cf-muted">
              {r.data.progress.status === 'solved'
                ? '✅'
                : r.data.progress.status === 'revision'
                  ? '🔁'
                  : ''}
              {r.data.progress.favorite ? ' ❤️' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-cf-muted">
          GitHub:{' '}
          {settings.github.connected ? (
            <b className="text-emerald-500">{settings.github.username}</b>
          ) : (
            'Not connected'
          )}
        </span>
        <Button variant="secondary" onClick={() => chrome.runtime.openOptionsPage()}>
          ⚙ Settings
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-cf-border bg-cf-surface p-2.5 text-center">
      <div className="text-xl font-bold text-cf-text">{value}</div>
      <div className="text-xs text-cf-muted">{label}</div>
    </div>
  );
}
