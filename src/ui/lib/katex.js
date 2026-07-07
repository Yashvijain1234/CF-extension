import renderMathInElement from 'katex/contrib/auto-render';

/** Typeset all `\( … \)` / `\[ … \]` (and `$…$`) math within an element. */
export function typesetMath(el) {
  if (!el) return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
      strict: 'ignore',
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    });
  } catch {
    // KaTeX best-effort: never break rendering over a malformed formula.
  }
}
