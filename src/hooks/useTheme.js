import { useEffect, useMemo, useState } from 'react';

/** Resolve the effective light/dark theme from the user's ThemeMode setting. */
export function useResolvedTheme(mode, hostTheme) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return useMemo(() => {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    // `auto` follows the host Codeforces theme, falling back to system pref.
    return hostTheme ?? (systemDark ? 'dark' : 'light');
  }, [mode, hostTheme, systemDark]);
}
