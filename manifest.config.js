import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

/**
 * Manifest V3 configuration for Codeforces LeetMode.
 *
 * The content script runs on all Codeforces problem pages so it can
 * detect problems, inject the floating button, and mount the overlay UI.
 * Running inside the page context lets us reuse the logged-in session and
 * CSRF tokens for submissions.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Codeforces LeetMode',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  options_page: 'src/options/index.html',
  // Registered so Vite builds the overlay page (loaded via iframe, not side panel).
  side_panel: {
    default_path: 'src/overlay/index.html',
  },
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://codeforces.com/*', 'https://*.codeforces.com/*'],
      js: ['src/content/index.jsx'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'tabs', 'scripting', 'identity'],
  host_permissions: [
    'https://codeforces.com/*',
    'https://*.codeforces.com/*',
    'https://api.github.com/*',
    'https://github.com/*',
  ],
  web_accessible_resources: [
    {
      resources: [
        'src/overlay/index.html',
        'src/overlay/*',
        'assets/*',
        'icons/*',
        'monacoeditorwork/*',
      ],
      matches: ['https://codeforces.com/*', 'https://*.codeforces.com/*'],
    },
  ],
});
