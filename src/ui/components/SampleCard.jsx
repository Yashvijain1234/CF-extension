import { CopyButton } from './common';

/** Input/output card for a single sample test, LeetCode-style. */
export function SampleCard({ sample, onUseAsInput }) {
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-cf-border bg-cf-surface">
      <div className="flex items-center justify-between border-b border-cf-border bg-cf-surface-2 px-3 py-1.5">
        <span className="text-xs font-semibold text-cf-muted">
          Example {sample.index}
        </span>
        {onUseAsInput && (
          <button
            type="button"
            onClick={() => onUseAsInput(sample.input, sample.output)}
            className="text-xs font-medium text-cf-accent hover:underline"
          >
            Use in Run
          </button>
        )}
      </div>
      <div className="grid gap-px bg-cf-border sm:grid-cols-2">
        <Block label="Input" text={sample.input} />
        <Block label="Output" text={sample.output} />
      </div>
    </div>
  );
}

function Block({ label, text }) {
  return (
    <div className="bg-cf-surface p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-cf-muted">
          {label}
        </span>
        <CopyButton text={text} />
      </div>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-cf-surface-2 p-2.5 font-mono text-[13px] leading-relaxed text-cf-text">
        {text || ' '}
      </pre>
    </div>
  );
}
