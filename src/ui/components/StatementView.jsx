import { useEffect, useRef } from 'react';
import { typesetMath } from '../lib/katex';

/** Renders a cleaned statement HTML fragment and typesets its math. */
export function StatementView({ html }) {
  const ref = useRef(null);

  useEffect(() => {
    typesetMath(ref.current);
  }, [html]);

  if (!html) return null;
  return (
    <div ref={ref} className="cf-statement" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
