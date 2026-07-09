/**
 * UI-side client for background-driven native Codeforces submissions.
 *
 * The overlay runs on chrome-extension:// (inside an iframe on the Codeforces
 * tab), so it can open a long-lived Port straight to the service worker. The
 * worker owns the whole flow — finding/opening the submit tab, injecting the
 * form-filling scripts, clicking Submit, confirming via the CF API — and
 * streams progress messages back here for the loading indicator.
 */

const PORT_NAME = 'cf-native-submit';

/**
 * Submit the given source natively through the real Codeforces submit page.
 *
 * @param {{ contestId: string|number, problemIndex: string, languageId: string,
 *           source: string, isGym?: boolean }} payload
 * @param {{ onProgress?: (update: { phase: string, message: string }) => void }} [opts]
 * @returns {Promise<{ queued: true, submissionId: number, handle: string|null }>}
 */
export function nativeSubmit(payload, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.connect) {
      reject(new Error('Extension messaging is unavailable. Reload the page and try again.'));
      return;
    }

    let port;
    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch (e) {
      reject(new Error(`Could not reach the extension worker: ${e?.message ?? e}`));
      return;
    }

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      try {
        port.disconnect();
      } catch {
        /* already gone */
      }
      fn(value);
    };

    port.onMessage.addListener((msg) => {
      if (msg?.type === 'PROGRESS') {
        onProgress?.({ phase: msg.phase, message: msg.message });
      } else if (msg?.type === 'RESULT') {
        if (msg.ok) finish(resolve, msg.data);
        else finish(reject, new Error(msg.error ?? 'Submission failed.'));
      }
    });

    // The worker being killed (or the extension reloading) mid-flight would
    // otherwise leave the promise hanging forever.
    port.onDisconnect.addListener(() => {
      finish(
        reject,
        new Error(
          chrome.runtime.lastError?.message ??
            'Lost connection to the extension worker during submission.',
        ),
      );
    });

    port.postMessage({ type: 'SUBMIT', payload });
  });
}
