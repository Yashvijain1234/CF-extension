/**
 * Codeforces submission service.
 *
 * IMPORTANT: this module must run inside the content-script context on a
 * `codeforces.com` page. That guarantees requests are same-origin and carry the
 * user's existing authenticated session cookies, exactly as if they had used
 * the real website. No credentials ever leave the browser.
 */

const ORIGIN = 'https://codeforces.com';

/** Random 18-char token Codeforces expects in its submit form (`ftaa`). */
function randomFtaa() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 18; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Extract the currently logged-in handle from the page header. */
export function getCurrentHandle() {
  const link = document.querySelector('#header a[href^="/profile/"]');
  if (link) {
    const m = link.getAttribute('href')?.match(/\/profile\/([^/]+)/);
    if (m) return m[1];
  }
  return null;
}

export function isLoggedIn() {
  return getCurrentHandle() !== null;
}

function submitPageUrl(req) {
  if (req.isGym) return `${ORIGIN}/gym/${req.contestId}/submit`;
  return `${ORIGIN}/contest/${req.contestId}/submit`;
}

/** Fetch and parse the CSRF token from a Codeforces page. */
async function fetchCsrfToken(url) {
  const res = await fetch(url, { credentials: 'include' });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = doc.querySelector('meta[name="X-Csrf-Token"]');
  if (meta?.content) return meta.content;
  const input = doc.querySelector('input[name="csrf_token"]');
  if (input?.value) return input.value;
  // Fall back to the token embedded in the current page.
  const local =
    document.querySelector('meta[name="X-Csrf-Token"]')?.content ||
    document.querySelector('input[name="csrf_token"]')?.value;
  if (local) return local;
  throw new Error('Could not retrieve CSRF token. Are you logged in to Codeforces?');
}

/**
 * Submit source code to Codeforces, mimicking the official submit form.
 * Returns whether the submission was queued; use {@link pollVerdict} afterwards.
 */
export async function submitSolution(req) {
  const pageUrl = submitPageUrl(req);
  const csrf = await fetchCsrfToken(pageUrl);

  const body = new FormData();
  body.append('csrf_token', csrf);
  body.append('ftaa', randomFtaa());
  body.append('bfaa', 'f1b3f18c715565b589b7823cda7448ce');
  body.append('action', 'submitSolutionFormSubmitted');
  body.append('submittedProblemIndex', req.problemIndex);
  body.append('programTypeId', req.languageId);
  body.append('source', req.source);
  body.append('tabSize', '4');
  body.append('sourceFile', '');
  body.append('_tta', '176');

  const res = await fetch(`${pageUrl}?csrf_token=${csrf}`, {
    method: 'POST',
    credentials: 'include',
    body,
  });

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const errorEl = doc.querySelector('.error.for__source, .error');
  const errorText = errorEl?.textContent?.trim();

  // If we were redirected to the "my submissions" page, submission succeeded.
  const redirectedToStatus =
    res.url.includes('/my') ||
    res.url.includes('/status') ||
    res.url.includes('/submissions');

  if (errorText && !redirectedToStatus) {
    return { queued: false, error: errorText };
  }
  return { queued: true };
}

const VERDICT_MAP = {
  OK: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  IDLENESS_LIMIT_EXCEEDED: 'IDLENESS_LIMIT_EXCEEDED',
  PARTIAL: 'PARTIAL',
  CHALLENGED: 'CHALLENGED',
  SKIPPED: 'SKIPPED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  TESTING: 'TESTING',
};

function mapVerdict(raw) {
  if (!raw) return 'PENDING';
  return VERDICT_MAP[raw] ?? 'UNKNOWN';
}

async function fetchRecentSubmissions(handle, count = 10) {
  const res = await fetch(
    `${ORIGIN}/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`,
    { credentials: 'include' },
  );
  const json = await res.json();
  if (json.status !== 'OK') throw new Error(json.comment ?? 'Codeforces API error');
  return json.result;
}

function toResult(s) {
  return {
    id: s.id,
    verdict: mapVerdict(s.verdict),
    rawVerdict: s.verdict ?? 'PENDING',
    timeConsumedMs: s.timeConsumedMillis,
    memoryConsumedKb: Math.round(s.memoryConsumedBytes / 1024),
    passedTestCount: s.passedTestCount,
    language: s.programmingLanguage,
    creationTimeSeconds: s.creationTimeSeconds,
  };
}

const TERMINAL = [
  'ACCEPTED',
  'WRONG_ANSWER',
  'RUNTIME_ERROR',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'COMPILATION_ERROR',
  'IDLENESS_LIMIT_EXCEEDED',
  'PARTIAL',
  'CHALLENGED',
  'SKIPPED',
  'REJECTED',
  'FAILED',
];

/**
 * Poll the Codeforces API until the newest matching submission reaches a
 * terminal verdict (or the timeout elapses).
 */
export async function pollVerdict(opts) {
  const handle = getCurrentHandle();
  if (!handle) throw new Error('Not logged in to Codeforces.');
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 120000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    let subs = [];
    try {
      subs = await fetchRecentSubmissions(handle);
    } catch {
      // Transient API failures shouldn't abort polling.
    }
    const match = subs.find(
      (s) =>
        s.problem.index === opts.problemIndex &&
        String(s.problem.contestId ?? s.contestId ?? '') === opts.contestId &&
        s.creationTimeSeconds >= opts.since - 5,
    );
    if (match) {
      const result = toResult(match);
      opts.onUpdate?.(result);
      if (TERMINAL.includes(result.verdict)) return result;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('Timed out waiting for a verdict.');
}

/** Fetch accepted (and other) submissions for the current problem. */
export async function fetchProblemSubmissions(contestId, problemIndex) {
  const handle = getCurrentHandle();
  if (!handle) return [];
  const subs = await fetchRecentSubmissions(handle, 100);
  return subs
    .filter(
      (s) =>
        s.problem.index === problemIndex &&
        String(s.problem.contestId ?? s.contestId ?? '') === contestId,
    )
    .map(toResult);
}
