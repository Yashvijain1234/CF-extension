import { useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { Play, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from './common';

/**
 * Custom test panel powered by Codeforces' Custom Invocation. The user supplies
 * stdin, presses Run, and the code is compiled + executed on the CF judge for
 * any language. Optionally paste an expected output to get a diff.
 */
export function TestRunner({ input, onInputChange, runState, onRun }) {
  const [expected, setExpected] = useState('');

  const running = runState.status === 'running';
  const output = runState.status === 'done' ? runState.result.output : '';
  const stat = runState.status === 'done' ? runState.result.stat : '';
  const verdict = runState.status === 'done' ? runState.result.verdict : '';
  const error = runState.status === 'error' ? runState.error : null;

  const normalize = (s) =>
    (s ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');

  const matches = useMemo(
    () => expected.length > 0 && normalize(expected) === normalize(output),
    [expected, output],
  );

  const diff = useMemo(() => {
    if (!expected) return [];
    return diffLines(normalize(expected), normalize(output));
  }, [expected, output]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <Field label="Custom Input (stdin)">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Type the input your program should read…"
          className="h-24 w-full resize-y rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text outline-none focus:border-cf-accent"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={running} variant="primary">
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Running on Codeforces…
            </>
          ) : (
            <>
              <Play size={14} /> Run
            </>
          )}
        </Button>
        {stat && <span className="text-xs text-cf-muted">{stat}</span>}
        {verdict && (
          <span className="text-xs font-semibold text-cf-text">{verdict}</span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400">
          <AlertTriangle size={14} className="mt-0.5 flex-none" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      <Field label="Output (stdout)">
        <pre className="min-h-[70px] w-full overflow-auto whitespace-pre-wrap rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text">
          {running ? 'Waiting for the Codeforces judge…' : output || ' '}
        </pre>
      </Field>

      <Field label="Expected Output (optional — for diff)">
        <textarea
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Paste expected output to compare…"
          className="h-20 w-full resize-y rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text outline-none focus:border-cf-accent"
        />
      </Field>

      {expected && (output || runState.status === 'done') && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-cf-muted">Diff</span>
            {matches ? (
              <span className="text-xs font-semibold text-emerald-500">
                ✓ Output matches
              </span>
            ) : (
              <span className="text-xs font-semibold text-rose-500">✗ Mismatch</span>
            )}
          </div>
          <pre className="max-h-56 overflow-auto rounded-lg border border-cf-border bg-cf-surface p-2.5 font-mono text-[13px] leading-relaxed">
            {diff.map((part, i) => (
              <div
                key={i}
                className={
                  part.added
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : part.removed
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'text-cf-muted'
                }
              >
                {part.value
                  .replace(/\n$/, '')
                  .split('\n')
                  .map((line, j) => (
                    <div key={j}>
                      <span className="mr-2 select-none opacity-60">
                        {part.added ? '+' : part.removed ? '-' : ' '}
                      </span>
                      {line || ' '}
                    </div>
                  ))}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-cf-muted">{label}</span>
      {children}
    </label>
  );
}
