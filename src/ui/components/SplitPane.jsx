import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight, dependency-free resizable split pane.
 *
 * `size` is the percentage the FIRST pane occupies. During a drag we update
 * local state for 60fps feedback and call `onCommit` once on release with the
 * final size (the parent persists it). A full-viewport overlay is rendered
 * while dragging so the Monaco editor / iframes never swallow pointer events.
 *
 * Works for both orientations, which lets us nest a vertical split (editor over
 * console) inside a horizontal split (problem beside editor).
 */
export function SplitPane({
  orientation = 'horizontal',
  size = 50,
  min = 15,
  max = 85,
  onChange,
  onCommit,
  first,
  second,
  className = '',
}) {
  const isH = orientation === 'horizontal';
  const containerRef = useRef(null);
  const sizeRef = useRef(size);
  const [pct, setPct] = useState(size);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setPct(size);
    sizeRef.current = size;
  }, [size]);

  const startDrag = useCallback(
    (e) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      setDragging(true);

      const move = (ev) => {
        const rect = container.getBoundingClientRect();
        const raw = isH
          ? ((ev.clientX - rect.left) / rect.width) * 100
          : ((ev.clientY - rect.top) / rect.height) * 100;
        const next = Math.min(max, Math.max(min, raw));
        sizeRef.current = next;
        setPct(next);
        onChange?.(next);
      };

      const up = () => {
        setDragging(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        onCommit?.(sizeRef.current);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [isH, min, max, onChange, onCommit],
  );

  const reset = useCallback(() => {
    setPct(50);
    sizeRef.current = 50;
    onCommit?.(50);
  }, [onCommit]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full min-h-0 min-w-0 ${isH ? 'flex-row' : 'flex-col'} ${className}`}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ [isH ? 'width' : 'height']: `${pct}%` }}
      >
        {first}
      </div>

      <div
        role="separator"
        aria-orientation={isH ? 'vertical' : 'horizontal'}
        onPointerDown={startDrag}
        onDoubleClick={reset}
        title="Drag to resize · double-click to reset"
        className={`group relative flex-none ${
          isH ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'
        } bg-cf-border transition-colors`}
      >
        {/* Invisible wider hit area for easy grabbing. */}
        <span
          className={`absolute ${
            isH ? '-left-1.5 -right-1.5 inset-y-0' : '-top-1.5 -bottom-1.5 inset-x-0'
          }`}
        />
        {/* Accent highlight on hover / active. */}
        <span
          className={`absolute ${
            isH ? '-left-px -right-px inset-y-0' : '-top-px -bottom-px inset-x-0'
          } transition-colors group-hover:bg-cf-accent ${dragging ? 'bg-cf-accent' : ''}`}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>

      {dragging && (
        <div
          className="fixed inset-0 z-[99]"
          style={{ cursor: isH ? 'col-resize' : 'row-resize' }}
        />
      )}
    </div>
  );
}
