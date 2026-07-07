import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  AArrowDown,
  AArrowUp,
  WrapText,
  Map as MapIcon,
  RotateCcw,
  Copy,
  Check,
  Download,
  Upload,
} from 'lucide-react';
import { LANGUAGES } from '@/api/languages';

/**
 * Monaco editor with a compact action toolbar: font size, word wrap, minimap,
 * reset to template, copy, download and upload. The language selector lives in
 * the app header (a global control), keeping this pane focused on the code.
 */
export function EditorPane({
  language,
  code,
  fontSize,
  theme,
  wordWrap,
  minimap,
  onCodeChange,
  onFontSize,
  onToggleWrap,
  onToggleMinimap,
  onReset,
  onEditorMount,
}) {
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution.${LANGUAGES[language].ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCodeChange(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-cf-border bg-cf-surface px-2.5 py-1.5">
        <span className="text-xs font-medium text-cf-muted">
          {LANGUAGES[language].label}
        </span>
        <div className="flex items-center gap-0.5">
          <ToolBtn
            title="Decrease font"
            onClick={() => onFontSize(Math.max(10, fontSize - 1))}
          >
            <AArrowDown size={15} />
          </ToolBtn>
          <span className="w-5 text-center text-xs tabular-nums text-cf-muted">
            {fontSize}
          </span>
          <ToolBtn
            title="Increase font"
            onClick={() => onFontSize(Math.min(28, fontSize + 1))}
          >
            <AArrowUp size={15} />
          </ToolBtn>
          <Divider />
          <ToolBtn title="Word wrap" active={wordWrap} onClick={onToggleWrap}>
            <WrapText size={15} />
          </ToolBtn>
          <ToolBtn title="Minimap" active={minimap} onClick={onToggleMinimap}>
            <MapIcon size={15} />
          </ToolBtn>
          <Divider />
          <ToolBtn title="Reset to template" onClick={onReset}>
            <RotateCcw size={15} />
          </ToolBtn>
          <ToolBtn title="Copy code" onClick={copy}>
            {copied ? (
              <Check size={15} className="text-emerald-500" />
            ) : (
              <Copy size={15} />
            )}
          </ToolBtn>
          <ToolBtn title="Download" onClick={download}>
            <Download size={15} />
          </ToolBtn>
          <ToolBtn title="Upload" onClick={() => fileInput.current?.click()}>
            <Upload size={15} />
          </ToolBtn>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={upload}
            accept=".cpp,.cc,.cxx,.java,.py,.kt,.rs,.go,.js,.cs,.txt"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={LANGUAGES[language].monaco}
          theme={theme}
          value={code}
          onChange={(v) => onCodeChange(v ?? '')}
          onMount={onEditorMount}
          options={{
            fontSize,
            minimap: { enabled: minimap },
            wordWrap: wordWrap ? 'on' : 'off',
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

function ToolBtn({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-cf-surface-2 ${
        active ? 'bg-cf-surface-2 text-cf-accent' : 'text-cf-muted hover:text-cf-text'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-cf-border" />;
}
