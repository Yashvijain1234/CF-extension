import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for the overlay:
 *  - Ctrl/Cmd + Enter → Submit
 *  - Ctrl/Cmd + S     → Save
 *  - Ctrl/Cmd + B     → Toggle Notes
 *  - Ctrl/Cmd + J     → Custom Input
 *
 * Bound to the overlay root so they don't hijack the underlying page.
 */
export function useKeyboardShortcuts(root, handlers) {
  useEffect(() => {
    const target = root ?? document.body;
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      switch (e.key.toLowerCase()) {
        case 'enter':
          e.preventDefault();
          handlers.onSubmit?.();
          break;
        case 's':
          e.preventDefault();
          handlers.onSave?.();
          break;
        case 'b':
          e.preventDefault();
          handlers.onToggleNotes?.();
          break;
        case 'j':
          e.preventDefault();
          handlers.onCustomInput?.();
          break;
      }
    };
    target.addEventListener('keydown', onKey, true);
    return () => target.removeEventListener('keydown', onKey, true);
  }, [root, handlers]);
}
