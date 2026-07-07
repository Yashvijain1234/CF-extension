import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/** Per-problem markdown notes with live preview. Autosaves via onChange. */
export function NotesPanel({ content, onChange }) {
  const [tab, setTab] = useState('write');

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 flex items-center gap-1">
        {['write', 'preview'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
              tab === t
                ? 'bg-cf-surface-2 text-cf-text'
                : 'text-cf-muted hover:text-cf-text'
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-cf-muted">Autosaved · Markdown</span>
      </div>

      {tab === 'write' ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Approach&#10;&#10;- Key idea…&#10;- Complexity: $O(n \log n)$"
          className="min-h-0 flex-1 resize-none rounded-lg border border-cf-border bg-cf-bg p-3 font-mono text-[13px] leading-relaxed text-cf-text outline-none focus:border-cf-accent"
        />
      ) : (
        <div className="cf-statement min-h-0 flex-1 overflow-y-auto rounded-lg border border-cf-border bg-cf-bg p-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {content || '_Nothing yet. Switch to Write to add notes._'}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
