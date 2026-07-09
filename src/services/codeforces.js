/**
 * Codeforces submission service.
 *
 * IMPORTANT: this module must run inside the content-script context on a
 * `codeforces.com` page. That guarantees requests are same-origin and carry the
 * user's existing authenticated session cookies, exactly as if they had used
 * the real website. No credentials ever leave the browser.
 */

const ORIGIN = 'https://codeforces.com';

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
