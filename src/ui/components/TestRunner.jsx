import { useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { Button } from './common';

/**
 * Local test runner: custom input, expected vs actual comparison, and a diff
 * viewer. JavaScript can be executed locally (in a sandboxed Worker); other
 * languages must be compiled remotely, so the user pastes actual output or uses
 * the Submit flow.
 */
export function TestRunner({ language, code, input, onInputChange }) {
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const runJs = async () => {
    setRunning(true);
    setError(null);
    try {
      const output = await runJavaScript(code, input);
      setActual(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const normalize = (s) =>
    s
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');

  const matches = useMemo(
    () => expected.length > 0 && normalize(expected) === normalize(actual),
    [expected, actual],
  );

  const diff = useMemo(() => {
    if (!expected && !actual) return [];
    return diffLines(normalize(expected), normalize(actual));
  }, [expected, actual]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <Field label="Custom Input">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="stdin for your program…"
          className="h-24 w-full resize-y rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text outline-none focus:border-cf-accent"
        />
      </Field>

      <div className="flex items-center gap-2">
        {language === 'javascript' ? (
          <Button onClick={runJs} disabled={running} variant="primary">
            {running ? 'Running…' : '▶ Run (JS)'}
          </Button>
        ) : (
          <span className="text-xs text-cf-muted">
            Local execution supported for JavaScript. For {language}, paste the actual
            output or use Submit.
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 font-mono text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Expected Output">
          <textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className="h-28 w-full resize-y rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text outline-none focus:border-cf-accent"
          />
        </Field>
        <Field label="Actual Output">
          <textarea
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="h-28 w-full resize-y rounded-lg border border-cf-border bg-cf-bg p-2.5 font-mono text-[13px] text-cf-text outline-none focus:border-cf-accent"
          />
        </Field>
      </div>

      {(expected || actual) && (
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

/** Run user JavaScript in a throwaway Worker with `input` piped via stdin. */
function runJavaScript(code, input) {
  return new Promise((resolve, reject) => {
    const harness = `
      self.onmessage = (e) => {
        const { code, input } = e.data;
        const logs = [];
        const origLog = console.log;
        console.log = (...a) => logs.push(a.join(' '));
        const require = (mod) => {
          if (mod === 'fs') {
            return { readFileSync: () => input };
          }
          throw new Error('module not available in local runner: ' + mod);
        };
        let idx = 0;
        const _lines = input.split('\\n');
        globalThis.readline = () => _lines[idx++];
        try {
          const fn = new Function('require', 'readline', code);
          fn(require, globalThis.readline);
          self.postMessage({ ok: true, output: logs.join('\\n') });
        } catch (err) {
          self.postMessage({ ok: false, error: String(err && err.message || err) });
        }
      };
    `;
    let worker;
    try {
      const blob = new Blob([harness], { type: 'text/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
    } catch {
      reject(
        new Error(
          'Local JS execution is blocked by the page security policy. Use Submit instead.',
        ),
      );
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Execution timed out (2s).'));
    }, 2000);
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      if (e.data.ok) resolve(e.data.output);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ code, input });
  });
}
