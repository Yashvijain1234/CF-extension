import { useCallback, useEffect, useState } from 'react';

/** Compute total elapsed ms including the currently-running segment. */
function computeElapsed(state) {
  if (state.runningSince == null) return state.elapsedMs;
  return state.elapsedMs + (Date.now() - state.runningSince);
}

/**
 * Solving timer driven by the persisted {@link TimerState}. The parent owns the
 * state (so it survives reloads); this hook renders a ticking display and
 * exposes start/pause/reset actions.
 */
export function useTimer(state, onChange, autoStart) {
  const [display, setDisplay] = useState(() => computeElapsed(state));

  // Auto-start once when mounted if configured and not already running.
  useEffect(() => {
    if (autoStart && state.runningSince == null && state.elapsedMs === 0) {
      onChange({ ...state, runningSince: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDisplay(computeElapsed(state));
    if (state.runningSince == null) return;
    const id = setInterval(() => setDisplay(computeElapsed(state)), 1000);
    return () => clearInterval(id);
  }, [state]);

  const running = state.runningSince != null;

  const start = useCallback(() => {
    if (state.runningSince == null) onChange({ ...state, runningSince: Date.now() });
  }, [state, onChange]);

  const pause = useCallback(() => {
    if (state.runningSince != null) {
      onChange({ elapsedMs: computeElapsed(state), runningSince: null });
    }
  }, [state, onChange]);

  const reset = useCallback(() => {
    onChange({ elapsedMs: 0, runningSince: null });
    setDisplay(0);
  }, [onChange]);

  const toggle = useCallback(
    () => (running ? pause() : start()),
    [running, pause, start],
  );

  return { display, running, start, pause, reset, toggle };
}

export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
