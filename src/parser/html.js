/**
 * HTML normalization helpers for the Codeforces statement parser.
 *
 * Codeforces renders formulas with MathJax (v2). Depending on when the content
 * script runs, formulas may exist as:
 *   1. `$$$latex$$$` literals (before MathJax runs), or
 *   2. `<span class="MathJax">…</span><script type="math/tex">latex</script>`.
 *
 * We normalize both into KaTeX-friendly `\( … \)` / `\[ … \]` delimiters and
 * strip MathJax's rendered artifacts so our UI can typeset cleanly.
 */

const CF_ORIGIN = 'https://codeforces.com';

function absolutizeUrl(url) {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${CF_ORIGIN}${url}`;
  return `${CF_ORIGIN}/${url}`;
}

/** Convert MathJax script tags + rendered spans into plain LaTeX delimiters. */
function normalizeMath(root) {
  // Remove MathJax rendered/preview nodes but keep the source scripts.
  root
    .querySelectorAll(
      '.MathJax, .MathJax_Display, .MathJax_Preview, .MathJax_Error, mjx-container',
    )
    .forEach((el) => el.remove());

  root.querySelectorAll('script[type^="math/tex"]').forEach((script) => {
    const tex = script.textContent ?? '';
    const isDisplay = (script.getAttribute('type') ?? '').includes('mode=display');
    const replacement = document.createTextNode(
      isDisplay ? `\\[${tex}\\]` : `\\(${tex}\\)`,
    );
    script.replaceWith(replacement);
  });
}

/** Absolutize <img> sources so they load outside the codeforces origin too. */
function normalizeImages(root) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', absolutizeUrl(src));
  });
}

/** Remove editing/analytics junk Codeforces sprinkles into statements. */
function stripNoise(root) {
  root
    .querySelectorAll('.section-title, .property-title, style, .MathJax_Menu')
    .forEach((el) => el.remove());
}

/** Replace Unicode math symbols that KaTeX strict mode rejects. */
function normalizeUnicodeMath(html) {
  return html
    .replace(/∗/g, '\\ast ')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/→/g, '\\to ')
    .replace(/∞/g, '\\infty ');
}

/**
 * Returns cleaned inner HTML for a statement section, ready for
 * `dangerouslySetInnerHTML` + KaTeX auto-render in the UI.
 */
export function cleanSectionHtml(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  normalizeMath(clone);
  normalizeImages(clone);
  stripNoise(clone);
  const html = normalizeUnicodeMath(
    clone.innerHTML
      .replace(/\$\$\$([\s\S]+?)\$\$\$/g, (_m, tex) => `\\(${tex}\\)`)
      .trim(),
  );
  return html;
}

/** Extract raw LaTeX formula sources from a node (best-effort). */
export function extractFormulas(node) {
  if (!node) return [];
  const formulas = [];
  node.querySelectorAll('script[type^="math/tex"]').forEach((s) => {
    const tex = s.textContent?.trim();
    if (tex) formulas.push(tex);
  });
  // Also capture un-rendered literals.
  const text = node.textContent ?? '';
  const literal = text.match(/\$\$\$([\s\S]+?)\$\$\$/g);
  if (literal) formulas.push(...literal.map((m) => m.replace(/\$\$\$/g, '').trim()));
  return Array.from(new Set(formulas));
}

export { absolutizeUrl };
