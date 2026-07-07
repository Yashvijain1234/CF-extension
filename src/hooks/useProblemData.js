import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultProblemData } from '@/types';
import { getProblemData, saveProblemData } from '@/storage';

/**
 * Loads and persists per-problem data (code, notes, progress, timer).
 * Writes are debounced to keep autosave cheap.
 */
export function useProblemData(key) {
  const [data, setData] = useState(defaultProblemData);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let active = true;
    getProblemData(key).then((d) => {
      if (active) {
        setData(d);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [key]);

  const persist = useCallback(
    (next) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveProblemData(key, next);
      }, 400);
    },
    [key],
  );

  const update = useCallback(
    (updater) => {
      setData((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Flush pending writes immediately (e.g. on Ctrl+S or unmount). */
  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setData((cur) => {
      saveProblemData(key, cur);
      return cur;
    });
  }, [key]);

  return { data, loaded, update, flush };
}
