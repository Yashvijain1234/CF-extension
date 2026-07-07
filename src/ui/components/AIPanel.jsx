import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { HINT_ACTIONS, buildPrompt } from '@/services/ai/prompts';
import { sendToBackground } from '@/services/messaging';
import { Spinner } from './common';

/** AI hint panel. LLM provider is configured in Settings; requests route
 * through the background worker so keys never touch the page. */
export function AIPanel({ problem, code, language, aiEnabled }) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [hintLevel, setHintLevel] = useState(0);

  const run = async (action) => {
    setLoading(true);
    setError(null);
    try {
      const level =
        action === 'next-hint' ? hintLevel : action === 'first-hint' ? 0 : hintLevel;
      const { system, prompt } = buildPrompt({
        action,
        problem,
        code,
        language,
        hintLevel: level,
      });
      const { text } = await sendToBackground({
        type: 'AI_COMPLETE',
        prompt,
        system,
      });
      setOutput(text);
      if (action === 'first-hint') setHintLevel(1);
      if (action === 'next-hint') setHintLevel((l) => l + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      {!aiEnabled && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-500">
          No AI provider configured. Open Settings → AI to add one (OpenAI, Anthropic,
          Gemini, or a custom endpoint).
        </div>
      )}
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {HINT_ACTIONS.map((h) => (
          <button
            key={h.action}
            type="button"
            disabled={loading || !aiEnabled}
            onClick={() => run(h.action)}
            className="flex items-center gap-1.5 rounded-lg border border-cf-border bg-cf-surface px-2.5 py-2 text-xs font-medium text-cf-text transition hover:bg-cf-surface-2 disabled:opacity-40"
          >
            <span>{h.icon}</span>
            {h.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-cf-border bg-cf-bg p-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-cf-muted">
            <Spinner /> Thinking…
          </div>
        )}
        {error && <div className="text-sm text-rose-500">{error}</div>}
        {!loading && !error && output && (
          <div className="cf-statement">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {output}
            </ReactMarkdown>
          </div>
        )}
        {!loading && !error && !output && (
          <p className="text-sm text-cf-muted">
            Pick an action above to get progressive hints, editorial explanations,
            complexity analysis, or a bug review.
          </p>
        )}
      </div>
    </div>
  );
}
