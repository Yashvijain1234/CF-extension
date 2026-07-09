/**
 * Proxy for Codeforces operations from the overlay iframe.
 *
 * The iframe runs on chrome-extension:// so it cannot access Codeforces
 * cookies. Every call is forwarded to the content script via postMessage.
 */

function nextId() {
  return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function postToPage(type, payload, { onPollUpdate } = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId();

    const onMessage = (event) => {
      const msg = event.data;
      if (!msg || msg.id !== id) return;

      if (msg.type === 'CF_POLL_UPDATE') {
        onPollUpdate?.(msg.result);
        return;
      }

      if (msg.type === 'CF_RUN_UPDATE') {
        onPollUpdate?.(msg.update);
        return;
      }

      if (msg.type === 'CF_RESPONSE') {
        window.removeEventListener('message', onMessage);
        if (msg.ok) resolve(msg.data);
        else reject(new Error(msg.error ?? 'Request failed'));
      }
    };

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type, payload, id }, '*');
  });
}

export function isLoggedIn() {
  return postToPage('CF_IS_LOGGED_IN');
}

export function getHandle() {
  return postToPage('CF_GET_HANDLE');
}

export function pollVerdict(opts) {
  const { onUpdate, ...payload } = opts;
  return postToPage('CF_POLL', payload, { onPollUpdate: onUpdate });
}

export function fetchProblemSubmissions(contestId, problemIndex) {
  return postToPage('CF_FETCH_SUBMISSIONS', { contestId, problemIndex });
}

export function runCustomTest(opts) {
  const { onUpdate, ...payload } = opts;
  return postToPage('CF_RUN', payload, { onPollUpdate: onUpdate });
}

export function closeOverlay() {
  window.parent.postMessage({ type: 'CLOSE_OVERLAY' }, '*');
}
