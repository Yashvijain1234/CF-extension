import { useCallback, useEffect, useRef, useState } from 'react';
import { getLayout, saveLayout } from '@/storage';

/**
 * Reactive access to the resizable-panel layout (left width + bottom height),
 * persisted to chrome.storage so panel sizes survive reloads and navigation.
 * Writes are debounced so live dragging stays smooth.
 */
export function useLayout() {
  const [layout, setLayout] = useState({ leftWidth: 46, bottomHeight: 34 });
  const saveTimer = useRef(null);

  useEffect(() => {
    let active = true;
    getLayout().then((l) => active && setLayout(l));
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback((patch) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveLayout(next), 250);
      return next;
    });
  }, []);

  return { layout, commit };
}
