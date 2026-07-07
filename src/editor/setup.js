/**
 * Monaco bootstrap for the content-script overlay.
 *
 * We bundle Monaco locally (no CDN) so it works offline and isn't blocked by
 * Codeforces' Content Security Policy. Language-specific "web workers" are not
 * required for the competitive-programming languages we support (their
 * tokenizers run on the main thread), so we route every worker request to the
 * base editor worker, which Vite emits as a web-accessible chunk.
 */

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

let configured = false;

export function setupMonaco() {
  if (configured) return;
  configured = true;

  self.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };

  // Use our bundled instance instead of the default CDN loader.
  loader.config({ monaco });

  // JS/TS diagnostics rely on a dedicated worker we don't ship; silence them.
  monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });
}

export { monaco };
