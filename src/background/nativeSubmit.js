/**
 * Native Codeforces submission, orchestrated by the background service worker.
 *
 * Flow (all driven from here, so it works no matter which tab the custom UI
 * lives in):
 *
 *   1. The React UI (extension iframe) opens a long-lived Port and sends the
 *      source + language + problem coordinates.
 *   2. We locate an existing Codeforces submit tab for the contest, or open a
 *      new one next to the originating tab (`port.sender.tab`).
 *   3. Once the tab finishes loading we inject scripts with
 *      `chrome.scripting.executeScript`:
 *        - MAIN world: fill the form (CodeMirror → Ace → textarea fallback),
 *          select the problem + language, dispatch input/change events.
 *        - MAIN world: wait for the anti-bot Turnstile token, then click the
 *          official Submit button.
 *        - ISOLATED world: read any form validation error Codeforces renders.
 *   4. We confirm the submission actually landed by watching the CF API for a
 *      brand-new submission id (robust against silent rejections).
 *   5. Progress + the final result stream back over the Port so the UI can
 *      show a live loading indicator.
 *
 * Every failure mode (tab closed, not logged in, missing elements, network or
 * scripting errors, anti-bot timeout) resolves to a human-readable error that
 * is reported back to the UI instead of being swallowed.
 */

const ORIGIN = 'https://codeforces.com';

/** Port name shared with the UI-side client (src/services/nativeSubmit.js). */
export const NATIVE_SUBMIT_PORT = 'cf-native-submit';

const TAB_LOAD_TIMEOUT_MS = 30_000;
/** Interactive Turnstile challenges can take a while; be generous. */
const ANTIBOT_TIMEOUT_MS = 120_000;
const CONFIRM_TIMEOUT_MS = 45_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- *
 * Injected page functions.
 *
 * IMPORTANT: these are serialized and executed inside the Codeforces page, so
 * they must be fully self-contained — no imports, no closure over module
 * variables. Data goes in via `args`, results come back as the return value.
 * -------------------------------------------------------------------------- */

/**
 * Fill the Codeforces submit form. Runs in the MAIN world so it can drive the
 * page's own editor instances (CodeMirror / Ace) through their real APIs.
 *
 * @param {{ source: string, languageId: string, problemIndex: string }} payload
 * @returns {{ ok: true, handle: string|null, hasTurnstile: boolean }
 *          | { ok: false, code: string, message: string }}
 */
function pageFillForm(payload) {
  const fail = (code, message) => ({ ok: false, code, message });

  try {
    // --- Login check -------------------------------------------------------
    const profile = document.querySelector('#header a[href^="/profile/"]');
    if (!profile) {
      return fail(
        'NOT_LOGGED_IN',
        'You are not logged in to Codeforces. Log in on codeforces.com and try again.',
      );
    }
    const handleMatch = (profile.getAttribute('href') || '').match(
      /\/profile\/([^/]+)/,
    );
    const handle = handleMatch ? handleMatch[1] : null;

    // --- Locate the submit form --------------------------------------------
    const langSelect = document.querySelector('select[name="programTypeId"]');
    const form =
      (langSelect && langSelect.closest('form')) ||
      document.querySelector('form.submit-form');
    if (!form || !langSelect) {
      return fail(
        'FORM_NOT_FOUND',
        'Could not find the submit form on the Codeforces page. The page may still be loading, or Codeforces changed its layout.',
      );
    }

    // --- Select the problem (the submit page lists the whole contest) ------
    const idxSelect = form.querySelector('select[name="submittedProblemIndex"]');
    if (idxSelect) {
      const target = String(payload.problemIndex || '')
        .trim()
        .toUpperCase();
      const option = Array.from(idxSelect.options).find((o) => {
        const value = (o.value || '').trim().toUpperCase();
        const label = (o.textContent || '').trim().toUpperCase();
        return value === target || label.indexOf(target + ' -') === 0 || label === target;
      });
      if (!option) {
        return fail(
          'PROBLEM_NOT_FOUND',
          `Problem "${payload.problemIndex}" was not found in the submit-page dropdown.`,
        );
      }
      idxSelect.value = option.value;
      idxSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // --- Select the language ------------------------------------------------
    const langOption = Array.from(langSelect.options).find(
      (o) => String(o.value) === String(payload.languageId),
    );
    if (!langOption) {
      return fail(
        'LANGUAGE_NOT_AVAILABLE',
        'The selected language is not available in the Codeforces language dropdown for this contest.',
      );
    }
    langSelect.value = langOption.value;
    langSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // --- Write the source code ---------------------------------------------
    // Preferred: the page's rich editor instance (kept in sync with the
    // textarea by Codeforces' own change handlers). Fallback: raw textarea.
    let filledEditor = false;

    // CodeMirror attaches the instance to its wrapper element.
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      cmEl.CodeMirror.setValue(payload.source);
      if (typeof cmEl.CodeMirror.refresh === 'function') cmEl.CodeMirror.refresh();
      filledEditor = true;
    }

    // Codeforces' "toggle editor" on the submit page is Ace.
    try {
      const aceEl = document.querySelector('.ace_editor');
      if (aceEl && window.ace) {
        window.ace.edit(aceEl).setValue(payload.source, -1);
        filledEditor = true;
      }
    } catch (_) {
      /* Ace present but not scriptable — the textarea below still works. */
    }

    const ta =
      form.querySelector('textarea[name="source"]') ||
      document.querySelector('#sourceCodeTextarea');
    if (ta) {
      ta.value = payload.source;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (!ta && !filledEditor) {
      return fail(
        'EDITOR_NOT_FOUND',
        'Could not find the source-code editor (CodeMirror, Ace or textarea) on the submit page.',
      );
    }

    // --- Skip the "identical code" confirmation prompt ----------------------
    for (const name of ['sourceCodeConfirmed', 'doNotShowWarningAgain']) {
      let input = form.querySelector(`input[name="${name}"]`);
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
      }
      input.value = 'true';
    }

    const hasTurnstile = !!document.querySelector(
      '.cf-turnstile, [name="cf-turnstile-response"]',
    );
    return { ok: true, handle, hasTurnstile };
  } catch (e) {
    return fail('FILL_FAILED', e && e.message ? e.message : String(e));
  }
}

/**
 * Wait for the anti-bot Turnstile token (if the widget is present), then click
 * the official Submit button. Runs in the MAIN world; resolves after the click
 * so the caller knows the form was actually dispatched.
 *
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string }>}
 */
function pageClickSubmit(timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();

    const click = () => {
      const langSelect = document.querySelector('select[name="programTypeId"]');
      const form =
        (langSelect && langSelect.closest('form')) ||
        document.querySelector('form.submit-form');
      if (!form) {
        resolve({
          ok: false,
          code: 'FORM_NOT_FOUND',
          message: 'The submit form disappeared before the code could be submitted.',
        });
        return;
      }
      const btn = form.querySelector('input[type="submit"], button[type="submit"]');
      if (btn) btn.click();
      else form.submit();
      resolve({ ok: true });
    };

    const timer = setInterval(() => {
      try {
        const widget = document.querySelector(
          '.cf-turnstile, [name="cf-turnstile-response"]',
        );
        const tokenInput = document.querySelector('[name="cf-turnstile-response"]');
        const token = tokenInput ? tokenInput.value : '';
        const elapsed = Date.now() - started;

        // Token ready, or there is no Turnstile on this page at all (small
        // grace period in case the widget mounts late).
        if (token || (!widget && elapsed > 2000)) {
          clearInterval(timer);
          click();
        } else if (elapsed > timeoutMs) {
          clearInterval(timer);
          resolve({
            ok: false,
            code: 'ANTIBOT_TIMEOUT',
            message:
              'Timed out waiting for the Codeforces anti-bot check. Complete the check in the submit tab and try again.',
          });
        }
      } catch (e) {
        clearInterval(timer);
        resolve({
          ok: false,
          code: 'ANTIBOT_ERROR',
          message: e && e.message ? e.message : String(e),
        });
      }
    }, 400);
  });
}

/**
 * Read any validation error Codeforces rendered next to the submit form
 * (e.g. "You have submitted exactly the same code before"). Runs in the
 * ISOLATED world — DOM access is all it needs.
 *
 * @returns {string|null}
 */
function pageReadError() {
  // Only meaningful while the submit form is still on screen; after a
  // successful submission the page navigates away and this returns null.
  if (!document.querySelector('select[name="programTypeId"]')) return null;
  const el =
    document.querySelector('.error.for__source') ||
    Array.from(document.querySelectorAll('span.error, .error')).find(
      (e) => e.textContent && e.textContent.trim(),
    );
  return el ? el.textContent.trim() : null;
}

/* -------------------------------------------------------------------------- *
 * Background-side orchestration.
 * -------------------------------------------------------------------------- */

function submitPageUrl({ contestId, isGym }) {
  return `${ORIGIN}/${isGym ? 'gym' : 'contest'}/${contestId}/submit`;
}

/**
 * Execute an injected function in the given tab and unwrap the result.
 * Scripting failures (tab closed, page navigating, no permission) surface as
 * a friendly Error instead of a cryptic runtime rejection.
 */
async function execInTab(tabId, func, args, world = 'MAIN') {
  let frames;
  try {
    frames = await chrome.scripting.executeScript({
      target: { tabId },
      world,
      func,
      args,
    });
  } catch (e) {
    throw new Error(
      `Could not run the submission script in the Codeforces tab (it may have been closed): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  return frames?.[0]?.result;
}

/**
 * Find an already-open submit tab for this contest, or create a new one next
 * to the originating tab. Existing tabs are reloaded so the form, CSRF token
 * and Turnstile state are fresh.
 *
 * @returns {Promise<{ tab: chrome.tabs.Tab, created: boolean }>}
 */
async function findOrCreateSubmitTab(url, openerTabId) {
  const existing = await chrome.tabs.query({ url: `${url}*` }).catch(() => []);
  if (existing.length > 0) {
    const tab = existing[0];
    await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
    await chrome.tabs.reload(tab.id).catch(() => {});
    return { tab, created: false };
  }

  // The tab is opened focused on purpose: if the anti-bot check requires
  // interaction the user must be able to see it.
  try {
    const tab = await chrome.tabs.create({ url, active: true, openerTabId });
    return { tab, created: true };
  } catch {
    // openerTabId is rejected when the originating tab no longer exists.
    const tab = await chrome.tabs.create({ url, active: true });
    return { tab, created: true };
  }
}

/** Resolve once the tab has finished loading (or reject on close/timeout). */
function waitForTabLoad(tabId, timeoutMs = TAB_LOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const onRemoved = (id) => {
      if (id === tabId) {
        finish(new Error('The Codeforces submit tab was closed before it finished loading.'));
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    const timer = setTimeout(
      () => finish(new Error('The Codeforces submit page took too long to load.')),
      timeoutMs,
    );

    // The tab may already be loaded by the time the listener attaches.
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') finish();
      })
      .catch(() => finish(new Error('The Codeforces submit tab no longer exists.')));
  });
}

/** Fetch the user's most recent submissions via the public CF API. */
async function fetchRecentSubmissions(handle, count) {
  const res = await fetch(
    `${ORIGIN}/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`,
    { credentials: 'include' },
  );
  const json = await res.json();
  if (json.status !== 'OK') throw new Error(json.comment ?? 'Codeforces API error');
  return json.result;
}

async function fetchLatestSubmissionId(handle) {
  try {
    const subs = await fetchRecentSubmissions(handle, 1);
    return subs[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Confirm the submission actually landed by watching the CF API for a new
 * submission id, while also checking the page for a rendered form error
 * (identical code, rate limit, wrong language, …).
 *
 * @returns {Promise<number>} the new submission id
 */
async function confirmSubmission(tabId, handle, payload, prevId) {
  const started = Date.now();

  while (Date.now() - started < CONFIRM_TIMEOUT_MS) {
    await sleep(1200);

    // Fast failure: Codeforces re-rendered the form with an error message.
    const errorText = await execInTab(tabId, pageReadError, [], 'ISOLATED').catch(
      () => null, // tab closed mid-check — the API check below still decides
    );
    if (errorText) throw new Error(errorText);

    const subs = await fetchRecentSubmissions(handle, 5).catch(() => []);
    const match = subs.find(
      (s) =>
        s.id !== prevId &&
        s.problem.index === payload.problemIndex &&
        String(s.problem.contestId ?? s.contestId ?? '') === String(payload.contestId),
    );
    if (match) return match.id;
    // Fallback: the newest id changed even if problem fields differ slightly.
    if (subs[0] && subs[0].id !== prevId) return subs[0].id;
  }

  throw new Error(
    'The submission was sent but never appeared in your submission list. You may be submitting too fast — try again in a few seconds.',
  );
}

/**
 * Full submit pipeline. `progress` is called with human-readable status
 * strings that the UI shows next to its loading spinner.
 *
 * @param {{ contestId: string|number, problemIndex: string, languageId: string,
 *           source: string, isGym?: boolean }} payload
 * @param {chrome.tabs.Tab|null} senderTab tab hosting the custom UI (if alive)
 * @param {(message: string, phase: string) => void} progress
 * @returns {Promise<{ queued: true, submissionId: number, handle: string|null }>}
 */
async function runNativeSubmit(payload, senderTab, progress) {
  if (!payload?.contestId) throw new Error('Missing contest id; cannot submit.');
  if (!payload.source?.trim()) throw new Error('Source code is empty.');

  progress('Opening the Codeforces submit page…', 'opening');
  const url = submitPageUrl(payload);
  const { tab, created } = await findOrCreateSubmitTab(url, senderTab?.id);
  await waitForTabLoad(tab.id);

  // Codeforces redirects logged-out users to /enter — catch it early for a
  // precise error instead of a generic "form not found".
  const loaded = await chrome.tabs.get(tab.id).catch(() => null);
  if (!loaded) throw new Error('The Codeforces submit tab was closed.');
  if (loaded.url && loaded.url.includes('/enter')) {
    throw new Error(
      'You are not logged in to Codeforces. Log in on codeforces.com and try again.',
    );
  }

  progress('Filling in your code and language…', 'filling');
  const fill = await execInTab(tab.id, pageFillForm, [
    {
      source: payload.source,
      languageId: String(payload.languageId),
      problemIndex: String(payload.problemIndex ?? ''),
    },
  ]);
  if (!fill) throw new Error('The submission script returned no result.');
  if (!fill.ok) throw new Error(fill.message);

  // Snapshot the latest submission id BEFORE clicking, so a new id is proof
  // that this submission was accepted.
  const prevId = fill.handle ? await fetchLatestSubmissionId(fill.handle) : null;

  progress(
    fill.hasTurnstile
      ? 'Waiting for the anti-bot check (complete it in the submit tab if prompted)…'
      : 'Clicking Submit on Codeforces…',
    'submitting',
  );
  const click = await execInTab(tab.id, pageClickSubmit, [ANTIBOT_TIMEOUT_MS]);
  if (!click) throw new Error('The submit-click script returned no result.');
  if (!click.ok) throw new Error(click.message);

  progress('Confirming the submission with Codeforces…', 'confirming');
  if (!fill.handle) {
    throw new Error('Could not determine your Codeforces handle to confirm the submission.');
  }
  const submissionId = await confirmSubmission(tab.id, fill.handle, payload, prevId);

  // Tidy up: close the tab we opened and return focus to the custom UI.
  if (created) await chrome.tabs.remove(tab.id).catch(() => {});
  if (senderTab?.id != null) {
    await chrome.tabs.update(senderTab.id, { active: true }).catch(() => {});
  }

  return { queued: true, submissionId, handle: fill.handle };
}

/**
 * Port handler, wired up in the background entry point:
 *
 *   chrome.runtime.onConnect.addListener((port) => {
 *     if (port.name === 'cf-native-submit') handleNativeSubmitConnect(port);
 *   });
 *
 * A long-lived Port (instead of one-shot sendMessage) lets us stream progress
 * updates and survive submissions that outlast the 5-minute message timeout.
 */
export function handleNativeSubmitConnect(port) {
  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
  });

  const safePost = (msg) => {
    if (disconnected) return;
    try {
      port.postMessage(msg);
    } catch {
      disconnected = true;
    }
  };

  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'SUBMIT') return;
    try {
      const data = await runNativeSubmit(
        msg.payload,
        port.sender?.tab ?? null,
        (message, phase) => safePost({ type: 'PROGRESS', phase, message }),
      );
      safePost({ type: 'RESULT', ok: true, data });
    } catch (e) {
      safePost({
        type: 'RESULT',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
