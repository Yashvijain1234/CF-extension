import { useState } from 'react';
import { LANGUAGES } from '@/api/languages';
import { sendToBackground } from '@/services/messaging';
import { Button, Spinner } from './common';

/** LeetHub-style prompt to push an accepted solution to GitHub. */
export function GitHubPushModal({
  problem,
  result,
  source,
  language,
  repo,
  onClose,
  onAlwaysPush,
}) {
  const [onDuplicate, setOnDuplicate] = useState('update');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const push = async (always) => {
    setStatus('pushing');
    try {
      const res = await sendToBackground({
        type: 'GITHUB_PUSH_SOLUTION',
        payload: {
          problem,
          result,
          source,
          languageExt: LANGUAGES[language].ext,
          onDuplicate,
        },
      });
      setStatus('done');
      setMessage(
        `${res.action === 'skipped' ? 'Skipped' : 'Pushed'} → ${res.solutionUrl}`,
      );
      if (always) onAlwaysPush();
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[2147483600] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-cf-border bg-cf-bg p-5 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-cf-text">
          🎉 Accepted — push to GitHub?
        </h3>
        <p className="mb-4 text-sm text-cf-muted">
          {repo ? (
            <>
              Save <b className="text-cf-text">solution.{LANGUAGES[language].ext}</b> +
              README to <b className="text-cf-text">{repo}</b>.
            </>
          ) : (
            'No repository selected. Choose one in Settings first.'
          )}
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-cf-muted">
            If the file already exists
          </span>
          <select
            value={onDuplicate}
            onChange={(e) => setOnDuplicate(e.target.value)}
            className="w-full rounded-lg border border-cf-border bg-cf-surface px-2.5 py-2 text-sm text-cf-text outline-none"
          >
            <option value="update">Update existing file</option>
            <option value="keep-history">Keep history (snapshot old version)</option>
            <option value="skip">Skip upload</option>
          </select>
        </label>

        {status === 'done' && (
          <div className="mb-3 break-all rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-500">
            {message}
          </div>
        )}
        {status === 'error' && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-500">
            {message}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {status === 'done' ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="secondary"
            disabled={!repo || status === 'pushing'}
            onClick={() => push(true)}
          >
            Always Push Automatically
          </Button>
          <Button
            variant="success"
            disabled={!repo || status === 'pushing' || status === 'done'}
            onClick={() => push(false)}
          >
            {status === 'pushing' ? <Spinner /> : '⬆'} Push
          </Button>
        </div>
      </div>
    </div>
  );
}
