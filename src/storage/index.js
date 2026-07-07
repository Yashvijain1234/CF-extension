/**
 * Typed persistence layer built on top of `chrome.storage.local`.
 *
 * All extension state (settings + per-problem data) is stored locally. Keys are
 * namespaced to avoid collisions and to make targeted reads cheap.
 */

import { DEFAULT_SETTINGS, defaultProblemData } from '@/types';

const SETTINGS_KEY = 'cf_leetmode_settings';
const LAYOUT_KEY = 'cf_leetmode_layout';
const problemKey = (key) => `cf_problem_${key}`;

/** Default resizable-panel sizes (percentages). */
const DEFAULT_LAYOUT = {
  /** Width of the left (problem) pane as a % of the body. */
  leftWidth: 46,
  /** Height of the bottom (tests/console) pane as a % of the right column. */
  bottomHeight: 34,
};

export async function getLayout() {
  const result = await chrome.storage.local.get(LAYOUT_KEY);
  return { ...DEFAULT_LAYOUT, ...(result[LAYOUT_KEY] ?? {}) };
}

export async function saveLayout(patch) {
  const current = await getLayout();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [LAYOUT_KEY]: next });
  return next;
}

/** Deep-merge helper so newly added settings fields fall back to defaults. */
function mergeSettings(stored) {
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    github: { ...DEFAULT_SETTINGS.github, ...(stored.github ?? {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai ?? {}) },
  };
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return mergeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function patchSettings(patch) {
  const current = await getSettings();
  const next = mergeSettings({ ...current, ...patch });
  await saveSettings(next);
  return next;
}

export async function getProblemData(key) {
  const storageKey = problemKey(key);
  const result = await chrome.storage.local.get(storageKey);
  const stored = result[storageKey];
  if (!stored) return defaultProblemData();
  // Merge to backfill any missing nested fields across versions.
  const base = defaultProblemData();
  return {
    ...base,
    ...stored,
    progress: { ...base.progress, ...stored.progress },
    notes: { ...base.notes, ...stored.notes },
    timer: { ...base.timer, ...stored.timer },
    code: { ...base.code, ...stored.code },
  };
}

export async function saveProblemData(key, data) {
  await chrome.storage.local.set({ [problemKey(key)]: data });
}

export async function patchProblemData(key, patch) {
  const current = await getProblemData(key);
  const next = { ...current, ...patch };
  await saveProblemData(key, next);
  return next;
}

/** Subscribe to settings changes across contexts. Returns an unsubscribe fn. */
export function onSettingsChanged(cb) {
  const listener = (changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      cb(mergeSettings(changes[SETTINGS_KEY].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** List all stored problem keys (used by the popup dashboard). */
export async function listProblemKeys() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith('cf_problem_'))
    .map((k) => k.replace('cf_problem_', ''));
}
