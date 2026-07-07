/** User-configurable settings persisted in chrome.storage. */

export const DEFAULT_SETTINGS = {
  theme: 'auto',
  fontSize: 14,
  defaultLanguage: 'cpp',
  editorTheme: 'vs-dark',
  autoSave: true,
  animations: true,
  timerAutoStart: true,
  github: {
    connected: false,
    token: null,
    username: null,
    repo: null,
    branch: 'main',
    autoUpload: false,
    acceptedOnly: true,
  },
  ai: {
    provider: 'none',
    apiKey: null,
    model: 'gpt-4o-mini',
    baseUrl: null,
  },
};
