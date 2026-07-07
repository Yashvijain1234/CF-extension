import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupMonaco } from '@/editor/setup';
import { App } from '@/ui/App';
import { closeOverlay } from '@/services/pageBridge';
import '@/styles/global.css';
import 'katex/dist/katex.min.css';

let root = null;

function renderApp(problem, hostTheme) {
  // INIT can arrive more than once (load-event fallback + handshake); only
  // mount the React tree the first time.
  if (root) return;

  setupMonaco();

  const container = document.getElementById('root');
  if (!container) return;

  root = createRoot(container);
  root.render(
    <StrictMode>
      <App
        problem={problem}
        hostTheme={hostTheme}
        rootEl={container}
        onClose={closeOverlay}
      />
    </StrictMode>,
  );
}

window.addEventListener('message', (event) => {
  // INIT is sent by the content script on the Codeforces parent page.
  if (event.source !== window.parent) return;
  if (event.data?.type === 'INIT') {
    renderApp(event.data.problem, event.data.hostTheme ?? 'dark');
  }
});

// Tell the parent content script we're ready to receive INIT. The parent's
// contentWindow origin check gates who this reaches, so '*' is safe here.
window.parent?.postMessage({ type: 'OVERLAY_READY' }, '*');
