import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for the overlay:
 *  - Ctrl/Cmd + Enter     → Submit
 *  - Ctrl/Cmd + S         → Save
 *  - Ctrl/Cmd + B         → Toggle sidebar (problem pane)
 *  - Ctrl/Cmd + J         → Toggle tests / console
 *  - Ctrl/Cmd + Shift + L → Toggle theme
 *
 * Bound to the overlay root (capture phase) so they don't hijack the
 * underlying Codeforces page.
 */
export function useKeyboardShortcuts(root, handlers) {
  useEffect(() => {
    const target = root ?? document.body;
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (e.shiftKey && key === 'l') {
        e.preventDefault();
        handlers.onToggleTheme?.();
        return;
      }
      if (e.shiftKey) return;

      switch (key) {
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
          handlers.onToggleSidebar?.();
          break;
        case 'j':
          e.preventDefault();
          handlers.onToggleTests?.();
          break;
        default:
          break;
      }
    };
    target.addEventListener('keydown', onKey, true);
    return () => target.removeEventListener('keydown', onKey, true);
  }, [root, handlers]);
}
