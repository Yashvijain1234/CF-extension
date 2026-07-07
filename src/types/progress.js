/** Per-problem local user data: code, notes, timer, progress flags. */

/** Saved code per language for a given problem. */

export const defaultProblemData = () => ({
  progress: { status: 'none', favorite: false, starred: false, updatedAt: Date.now() },
  notes: { content: '', updatedAt: Date.now() },
  code: {},
  lastLanguage: null,
  timer: { elapsedMs: 0, runningSince: null },
});
