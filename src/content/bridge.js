/**
 * Message bridge between the extension iframe (UI) and the content script
 * (Codeforces page context). Submission and API calls must run in the content
 * script so they carry the user's Codeforces session cookies.
 */

import {
  fetchProblemSubmissions,
  getCurrentHandle,
  isLoggedIn,
  pollVerdict,
  runCustomTest,
} from '@/services/codeforces';

function isFromOverlay(event) {
  return (
    typeof event.origin === 'string' && event.origin.startsWith('chrome-extension://')
  );
}

function reply(event, payload) {
  event.source?.postMessage(payload, event.origin);
}

/** Install once from the content script. `onClose` removes the iframe overlay. */
export function installBridge(onClose) {
  window.addEventListener('message', async (event) => {
    if (!isFromOverlay(event)) return;
    const msg = event.data;
    if (!msg?.type) return;

    switch (msg.type) {
      case 'CF_IS_LOGGED_IN':
        reply(event, { type: 'CF_RESPONSE', id: msg.id, ok: true, data: isLoggedIn() });
        break;

      case 'CF_GET_HANDLE':
        reply(event, {
          type: 'CF_RESPONSE',
          id: msg.id,
          ok: true,
          data: getCurrentHandle(),
        });
        break;

      case 'CF_POLL':
        try {
          const data = await pollVerdict({
            ...msg.payload,
            onUpdate: (result) => {
              event.source?.postMessage(
                { type: 'CF_POLL_UPDATE', id: msg.id, result },
                event.origin,
              );
            },
          });
          reply(event, { type: 'CF_RESPONSE', id: msg.id, ok: true, data });
        } catch (err) {
          reply(event, {
            type: 'CF_RESPONSE',
            id: msg.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;

      case 'CF_RUN':
        try {
          const data = await runCustomTest({
            ...msg.payload,
            onUpdate: (update) => {
              event.source?.postMessage(
                { type: 'CF_RUN_UPDATE', id: msg.id, update },
                event.origin,
              );
            },
          });
          reply(event, { type: 'CF_RESPONSE', id: msg.id, ok: true, data });
        } catch (err) {
          reply(event, {
            type: 'CF_RESPONSE',
            id: msg.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;

      case 'CF_FETCH_SUBMISSIONS':
        try {
          const data = await fetchProblemSubmissions(
            msg.payload.contestId,
            msg.payload.problemIndex,
          );
          reply(event, { type: 'CF_RESPONSE', id: msg.id, ok: true, data });
        } catch (err) {
          reply(event, {
            type: 'CF_RESPONSE',
            id: msg.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;

      case 'CLOSE_OVERLAY':
        onClose?.();
        break;

      default:
        break;
    }
  });
}
