import { useState } from 'react';

/** Small colored pill used for tags, difficulty, meta info. */
export function Badge({ children, color, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={
        color
          ? { color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return (
    <span
      className="inline-block animate-spin-slow rounded-full border-2 border-cf-border border-t-cf-accent"
      style={{ width: size, height: size }}
      aria-label="loading"
    />
  );
}

export function IconButton({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-cf-border text-cf-muted transition hover:bg-cf-surface-2 hover:text-cf-text ${
        active ? 'bg-cf-surface-2 text-cf-accent' : ''
      }`}
    >
      {children}
    </button>
  );
}

/** Copy-to-clipboard button with transient "Copied" feedback. */
export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
      className="rounded-md border border-cf-border px-2 py-1 text-xs font-medium text-cf-muted transition hover:bg-cf-surface-2 hover:text-cf-text"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

/** Collapsible section with a header. */
export function Collapsible({ title, defaultOpen = true, right, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-cf-border bg-cf-surface">
      <header
        className="flex cursor-pointer items-center justify-between px-4 py-2.5 select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-cf-text">
          <span
            className="text-cf-muted transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ▸
          </span>
          {title}
        </div>
        <div onClick={(e) => e.stopPropagation()}>{right}</div>
      </header>
      {open && <div className="border-t border-cf-border px-4 py-3">{children}</div>}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  title,
}) {
  const styles = {
    primary: 'bg-cf-accent text-white hover:bg-cf-accent-hover',
    secondary: 'border border-cf-border bg-cf-surface text-cf-text hover:bg-cf-surface-2',
    ghost: 'text-cf-muted hover:bg-cf-surface-2 hover:text-cf-text',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
