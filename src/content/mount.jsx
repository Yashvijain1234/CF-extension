/**
 * Mounts the Better UI inside an extension-origin iframe.
 *
 * Running the React + Monaco app on chrome-extension:// (not codeforces.com)
 * fixes web-worker CORS errors, font loading, and CSP conflicts that occur
 * when heavy UI libraries run directly inside a content script.
 */

import { detectCodeforcesTheme } from '@/parser';

const IFRAME_ID = 'cf-leetmode-iframe';

let iframe = null;
let onOverlayReady = null;

function sendInit(problem) {
  // Target origin is '*' on purpose: the overlay document is a
  // chrome-extension:// page whose origin is sometimes reported as 'null'
  // (opaque) at load time, which makes a specific target origin fail with
  // "The target origin provided ... does not match the recipient window's
  // origin ('null')". We already post to a specific contentWindow we created
  // and control, so '*' is safe here.
  iframe?.contentWindow?.postMessage(
    {
      type: 'INIT',
      problem,
      hostTheme: detectCodeforcesTheme(),
    },
    '*',
  );
}

export function mountApp(problem) {
  if (iframe) return;

  iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.src = chrome.runtime.getURL('src/overlay/index.html');
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  Object.assign(iframe.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    border: 'none',
    zIndex: '2147483500',
    background: 'transparent',
  });

  // Handshake: the overlay posts OVERLAY_READY once its script is running and a
  // message listener is attached. This avoids the race where INIT is sent on
  // the iframe 'load' event before the overlay is ready to receive it.
  onOverlayReady = (event) => {
    if (event.source !== iframe?.contentWindow) return;
    if (event.data?.type !== 'OVERLAY_READY') return;
    sendInit(problem);
  };
  window.addEventListener('message', onOverlayReady);

  // Fallback for the case where the overlay was already ready before we
  // attached the listener (e.g. cached load).
  iframe.addEventListener('load', () => sendInit(problem));

  document.documentElement.style.overflow = 'hidden';
  document.documentElement.appendChild(iframe);
}

export function unmountApp() {
  if (onOverlayReady) {
    window.removeEventListener('message', onOverlayReady);
    onOverlayReady = null;
  }
  iframe?.remove();
  iframe = null;
  document.documentElement.style.overflow = '';
}

export function isMounted() {
  return iframe !== null;
}
