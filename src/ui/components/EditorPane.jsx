import Editor from '@monaco-editor/react';
import { LANGUAGE_LIST, LANGUAGES } from '@/api/languages';

export function EditorPane({
  language,
  code,
  fontSize,
  theme,
  onCodeChange,
  onLanguageChange,
  onFontSize,
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-cf-border bg-cf-surface px-3 py-1.5">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="rounded-md border border-cf-border bg-cf-bg px-2 py-1 text-xs font-medium text-cf-text outline-none"
        >
          {LANGUAGE_LIST.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Decrease font size"
            onClick={() => onFontSize(Math.max(10, fontSize - 1))}
            className="h-6 w-6 rounded border border-cf-border text-cf-muted hover:text-cf-text"
          >
            A-
          </button>
          <span className="w-6 text-center text-xs text-cf-muted">{fontSize}</span>
          <button
            type="button"
            title="Increase font size"
            onClick={() => onFontSize(Math.min(28, fontSize + 1))}
            className="h-6 w-6 rounded border border-cf-border text-cf-muted hover:text-cf-text"
          >
            A+
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={LANGUAGES[language].monaco}
          theme={theme}
          value={code}
          onChange={(v) => onCodeChange(v ?? '')}
          options={{
            fontSize,
            minimap: { enabled: false },
            fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
            fontLigatures: true,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            renderWhitespace: 'selection',
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
