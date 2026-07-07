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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read the CSRF token embedded in the current Codeforces page. */
function getPageCsrf() {
  const meta = document.querySelector('meta[name="X-Csrf-Token"]')?.content;
  if (meta) return meta;
  const input = document.querySelector('input[name="csrf_token"]')?.value;
  if (input) return input;
  throw new Error('CSRF token not found. Reload the Codeforces page and try again.');
}

/** Strip HTML tags Codeforces sometimes wraps around the verdict text. */
function stripTags(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Run code through Codeforces' Custom Invocation ("custom test"), which
 * compiles and executes the source on the CF judge with the given stdin and
 * returns the program output. Works for every supported language.
 *
 * Runs in the content-script context so it reuses the logged-in session + CSRF.
 */
export async function runCustomTest(req) {
  const csrf = getPageCsrf();
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Csrf-Token': csrf,
  };

  const submitBody = new URLSearchParams({
    csrf_token: csrf,
    action: 'submitSourceCode',
    source: req.source,
    sourceCode: req.source,
    tabSize: '4',
    programTypeId: req.languageId,
    input: req.input ?? '',
    output: '',
    communityCode: '',
    _tta: '176',
  });

  const res = await fetch(`${ORIGIN}/data/customtest`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: submitBody.toString(),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      'Codeforces rejected the custom test (unexpected response). Are you logged in?',
    );
  }

  const id = data.customTestSubmitId;
  if (!id) {
    const msg =
      data['error'] ||
      data['customTest_errorMessage'] ||
      Object.values(data).find((v) => typeof v === 'string' && /error/i.test(v));
    throw new Error(msg || 'Custom test was rejected by Codeforces.');
  }

  const timeout = req.timeoutMs ?? 60000;
  const interval = req.intervalMs ?? 2000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    await sleep(interval);
    const pollBody = new URLSearchParams({
      csrf_token: csrf,
      communityCode: '',
      action: 'getVerdict',
      customTestSubmitId: String(id),
    });
    let poll;
    try {
      const pres = await fetch(`${ORIGIN}/data/customtest`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: pollBody.toString(),
      });
      poll = await pres.json();
    } catch {
      continue; // transient error; keep polling
    }

    if (poll.verdict != null && String(poll.customTestSubmitId) === String(id)) {
      return {
        submitId: id,
        output: poll.output ?? '',
        stat: stripTags(poll.stat),
        verdict: stripTags(poll.verdict),
      };
    }
    req.onUpdate?.({ phase: 'running' });
  }

  throw new Error('Custom test timed out. The CF judge may be busy — try again.');
}

function submitPageUrl(req) {
  if (req.isGym) return `${ORIGIN}/gym/${req.contestId}/submit`;
  return `${ORIGIN}/contest/${req.contestId}/submit`;
}

/**
 * Select the target problem in the Codeforces submit-page dropdown. The submit
 * page lists every problem of the contest, so the correct index (A, B, C, …)
 * must be chosen for the submission to be accepted.
 */
function selectProblemIndex(doc, problemIndex) {
  if (!problemIndex) return false;
  const select = doc.querySelector('select[name="submittedProblemIndex"]');
  if (!select) return false;

  const target = String(problemIndex).trim().toUpperCase();
  const option = Array.from(select.options).find((o) => {
    const value = (o.value ?? '').trim().toUpperCase();
    const label = (o.textContent ?? '').trim().toUpperCase();
    return value === target || label.startsWith(`${target} -`) || label === target;
  });
  if (!option) return false;

  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/**
 * Copy the problem number (contest id + index, e.g. "1234A") to the clipboard
 * so the user can paste/verify it if the dropdown can't be auto-selected.
 */
async function copyProblemNumber(req) {
  const number = `${req.contestId ?? ''}${req.problemIndex ?? ''}`.trim();
  if (!number) return;
  try {
    await navigator.clipboard.writeText(number);
  } catch {
    // Fallback for contexts where the async Clipboard API is unavailable.
    const ta = document.createElement('textarea');
    ta.value = number;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
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

/** Fetch the id of the user's most recent submission (or null). */
async function fetchLatestSubmissionId(handle) {
  try {
    const subs = await fetchRecentSubmissions(handle, 1);
    return subs[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Submit source code to Codeforces, mimicking the official submit form.
 *
 * Success is confirmed by detecting a brand-new submission via the API (rather
 * than fragile HTML parsing), so callers get a precise submission id to poll
 * and clear errors when a submission is rejected (e.g. identical code, too
 * fast, wrong language). Returns { queued, submissionId?, error? }.
 */
export async function submitSolution(req) {
  const handle = getCurrentHandle();
  if (!handle) return { queued: false, error: 'You are not logged in to Codeforces.' };

  const pageUrl = submitPageUrl(req);
  const csrf = await fetchCsrfToken(pageUrl);
  const prevId = await fetchLatestSubmissionId(handle);

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
  // Allow re-submitting identical code without CF's confirmation prompt.
  body.append('sourceCodeConfirmed', 'true');
  body.append('doNotShowWarningAgain', 'true');
  body.append('_tta', '176');

  const res = await fetch(`${pageUrl}?csrf_token=${csrf}`, {
    method: 'POST',
    credentials: 'include',
    body,
  });

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Codeforces now guards the submit form with a Cloudflare Turnstile
  // ("anti-bot verification") whose token can't be produced by a background
  // fetch. Detect it so the caller can fall back to the native submit page.
  const hasTurnstile =
    doc.querySelector('.cf-turnstile, [name="cf-turnstile-response"]') !== null;

  // CF renders form errors in a <span class="error for__source"> (or similar).
  const errorEl =
    doc.querySelector('.error.for__source') ||
    Array.from(doc.querySelectorAll('span.error, .error')).find((e) =>
      e.textContent?.trim(),
    );
  const errorText = errorEl?.textContent?.trim();

  if (hasTurnstile || /anti-?bot|verification|turnstile/i.test(errorText ?? '')) {
    return { queued: false, antiBot: true, error: errorText };
  }
  if (errorText) return { queued: false, error: errorText };

  // Confirm the submission actually landed by watching for a new id.
  for (let i = 0; i < 6; i++) {
    await sleep(1200);
    const subs = await fetchRecentSubmissions(handle, 5).catch(() => []);
    const match = subs.find(
      (s) =>
        s.id !== prevId &&
        s.problem.index === req.problemIndex &&
        String(s.problem.contestId ?? s.contestId ?? '') === String(req.contestId),
    );
    if (match) return { queued: true, submissionId: match.id };
    // Fallback: the newest id changed even if problem fields differ slightly.
    if (subs[0] && subs[0].id !== prevId) {
      return { queued: true, submissionId: subs[0].id };
    }
  }

  return {
    queued: false,
    error:
      'The submission was sent but never appeared. You may be submitting too fast, or Codeforces rejected it. Try again or submit on the site.',
  };
}

/**
 * Fallback submit that drives the REAL Codeforces submit page in an overlay
 * iframe. This is required because CF's anti-bot Turnstile can only be solved on
 * a genuine page. We pre-fill the language + source, show the page so the user
 * can complete verification and press Submit, then watch the API for the new
 * submission id and resolve with it (so the app can poll the verdict).
 */
export function submitViaPage(req) {
  return new Promise((resolve) => {
    const handle = getCurrentHandle();
    if (!handle) {
      resolve({ queued: false, error: 'You are not logged in to Codeforces.' });
      return;
    }

    const WRAP_ID = 'cf-leetmode-native-submit';
    document.getElementById(WRAP_ID)?.remove();

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    Object.assign(wrap.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483600',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(6, 8, 12, 0.75)',
      backdropFilter: 'blur(2px)',
    });

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 16px',
      background: '#161b22',
      color: '#e6edf3',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      borderBottom: '1px solid #2a313c',
    });
    bar.innerHTML =
      '<span><b>Finish your submission.</b> Your code and problem are pre-filled (the problem number is also copied to your clipboard) — complete the anti-bot check if shown and press <b>Submit</b>. The verdict appears automatically.</span>';

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '8px', flex: '0 0 auto' });

    const btnStyle = {
      padding: '6px 14px',
      borderRadius: '8px',
      border: '1px solid #2a313c',
      background: '#0e1116',
      color: '#e6edf3',
      cursor: 'pointer',
      fontWeight: '600',
    };

    const newTabBtn = document.createElement('button');
    newTabBtn.textContent = 'Open in new tab';
    Object.assign(newTabBtn.style, btnStyle);
    newTabBtn.addEventListener('click', () =>
      window.open(submitPageUrl(req), '_blank', 'noopener'),
    );

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    Object.assign(closeBtn.style, btnStyle);

    const iframe = document.createElement('iframe');
    iframe.src = submitPageUrl(req);
    Object.assign(iframe.style, {
      flex: '1 1 auto',
      width: '100%',
      border: 'none',
      background: '#fff',
    });

    btnRow.appendChild(newTabBtn);
    btnRow.appendChild(closeBtn);
    bar.appendChild(btnRow);
    wrap.appendChild(bar);
    wrap.appendChild(iframe);
    document.documentElement.appendChild(wrap);

    let settled = false;
    let poller = null;
    let prevId = null;

    const cleanup = () => {
      if (poller) clearInterval(poller);
      wrap.remove();
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    closeBtn.addEventListener('click', () =>
      finish({ queued: false, error: 'Submission cancelled.' }),
    );

    // Copy the problem number to the clipboard so the user can paste/verify it
    // in case the dropdown can't be selected automatically.
    copyProblemNumber(req).catch(() => {});

    // Pre-fill the native form once it loads (best effort; same-origin).
    const prefill = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc) return;

        // Select the target problem — required on the /contest/{id}/submit
        // page, which lists every problem of the contest in a dropdown.
        selectProblemIndex(doc, req.problemIndex);

        const langSelect = doc.querySelector('select[name="programTypeId"]');
        if (langSelect) {
          langSelect.value = req.languageId;
          langSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill the visible Ace editor if present so the user sees their code.
        try {
          const aceEl = doc.querySelector('.ace_editor');
          if (aceEl && win?.ace) {
            win.ace.edit(aceEl).setValue(req.source, -1);
          }
        } catch {
          /* ignore Ace access issues */
        }

        const ta = doc.querySelector('textarea[name="source"], #sourceCodeTextarea');
        if (ta) {
          ta.value = req.source;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch {
        /* cross-origin or markup change: user can still paste manually */
      }
    };

    iframe.addEventListener('load', prefill);

    // Snapshot the latest submission id, then watch for a new one.
    fetchLatestSubmissionId(handle).then((id) => {
      prevId = id;
      const started = Date.now();
      poller = setInterval(async () => {
        if (Date.now() - started > 300000) {
          finish({ queued: false, error: 'Timed out waiting for submission.' });
          return;
        }
        const subs = await fetchRecentSubmissions(handle, 5).catch(() => []);
        const match = subs.find(
          (s) =>
            s.id !== prevId &&
            s.problem.index === req.problemIndex &&
            String(s.problem.contestId ?? s.contestId ?? '') ===
              String(req.contestId),
        );
        if (match) finish({ queued: true, submissionId: match.id });
      }, 1500);
    });
  });
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
    const match = subs.find((s) =>
      opts.submissionId
        ? s.id === opts.submissionId
        : s.problem.index === opts.problemIndex &&
          String(s.problem.contestId ?? s.contestId ?? '') ===
            String(opts.contestId) &&
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
