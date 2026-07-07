/**
 * Content-script entry point.
 *
 * Kept intentionally tiny: it only detects Codeforces problem pages and injects
 * the floating "Open in Better UI" button. The heavy React + Monaco app is
 * lazy-loaded on demand (dynamic import) so normal Codeforces browsing stays
 * fast and memory-light.
 */

import { detectProblem, detectCodeforcesTheme, parseProblem } from '@/parser';
import { mountApp, isMounted, unmountApp } from './mount';
import { installBridge } from './bridge';

// Bridge must be ready before the iframe sends submit/API requests.
installBridge(() => unmountApp());

const FAB_ID = 'cf-leetmode-fab';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;

function getProblem() {
  if (
    cache &&
    Date.now() - cache.parsedAt < CACHE_TTL_MS &&
    cache.url === location.href
  ) {
    return cache;
  }
  const parsed = parseProblem();
  if (parsed) cache = parsed;
  return parsed;
}

async function openOverlay() {
  try {
    const problem = getProblem();
    if (!problem) {
      alert(
        'Codeforces LeetMode: could not parse this problem. Try refreshing the page.',
      );
      return;
    }
    if (!isMounted()) mountApp(problem);
  } catch (err) {
    console.error('[Codeforces LeetMode] Failed to open overlay:', err);
    alert(
      `Codeforces LeetMode failed to load the UI.\n\n${err instanceof Error ? err.message : String(err)}\n\nTry reloading the extension in chrome://extensions`,
    );
  }
}

function injectFab() {
  if (document.getElementById(FAB_ID)) return;
  const locator = detectProblem();
  if (!locator) return;

  const btn = document.createElement('button');
  btn.id = FAB_ID;
  btn.className = 'cf-lm-fab';
  if (detectCodeforcesTheme() === 'dark') btn.classList.add('cf-lm-fab-dark');
  btn.innerHTML = '<span>✨</span><span>Open in Better UI</span>';
  // Inline fallback styles in case extension CSS injection is delayed.
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483000',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    border: 'none',
    borderRadius: '999px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    color: '#fff',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
  });
  btn.addEventListener('click', () => void openOverlay());
  document.body.appendChild(btn);
}

function removeFab() {
  document.getElementById(FAB_ID)?.remove();
}

function sync() {
  if (detectProblem()) injectFab();
  else removeFab();
}

// Initial run.
sync();

// Handle Codeforces' occasional client-side navigations without a full reload.
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    cache = null;
    sync();
  }
});
observer.observe(document.documentElement, { subtree: true, childList: true });

window.addEventListener('popstate', () => {
  cache = null;
  sync();
});

// Global shortcut to open the overlay quickly (Alt+O) without the button.
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'o' && detectProblem()) {
    e.preventDefault();
    void openOverlay();
  }
});
