import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/types';
import { getSettings, onSettingsChanged, patchSettings } from '@/storage';

/** Reactive access to extension settings, synced across contexts. */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSettings().then((s) => {
      if (active) {
        setSettings(s);
        setLoading(false);
      }
    });
    const unsub = onSettingsChanged((s) => active && setSettings(s));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const update = useCallback(async (patch) => {
    const next = await patchSettings(patch);
    setSettings(next);
    return next;
  }, []);

  return { settings, loading, update };
}
