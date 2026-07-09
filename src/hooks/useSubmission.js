import { useCallback, useState } from 'react';
import { LANGUAGES } from '@/api/languages';
import { isLoggedIn, pollVerdict } from '@/services/pageBridge';
import { nativeSubmit } from '@/services/nativeSubmit';

/**
 * Drives the full submit → poll → verdict flow:
 *
 *   1. The background worker opens (or reuses) the real Codeforces submit tab,
 *      injects the code + language into the native form (CodeMirror / Ace /
 *      textarea), clicks the official Submit button and confirms the new
 *      submission id via the CF API. Progress streams back live.
 *   2. Verdict polling then runs in the content script (same-origin, reusing
 *      the logged-in session) until the judge reaches a terminal verdict.
 *
 * State shape: { phase, message?, result?, error? } where phase is one of
 * 'idle' | 'submitting' | 'polling' | 'done' | 'error'. `message` carries the
 * human-readable progress text for the loading indicator.
 */
export function useSubmission(problem) {
  const [state, setState] = useState({ phase: 'idle' });

  const submit = useCallback(
    async (language, source) => {
      if (!problem.contestId) {
        const s = {
          phase: 'error',
          error: 'Missing contest id; cannot submit this problem.',
        };
        setState(s);
        return s;
      }
      if (!(await isLoggedIn().catch(() => false))) {
        const s = {
          phase: 'error',
          error: 'You are not logged in to Codeforces.',
        };
        setState(s);
        return s;
      }
      if (!source.trim()) {
        const s = { phase: 'error', error: 'Source code is empty.' };
        setState(s);
        return s;
      }

      const since = Math.floor(Date.now() / 1000);
      try {
        setState({
          phase: 'submitting',
          message: 'Preparing your submission…',
        });
        const outcome = await nativeSubmit(
          {
            contestId: problem.contestId,
            problemIndex: problem.problemIndex,
            languageId: LANGUAGES[language].cfId,
            source,
            isGym: problem.url.includes('/gym/'),
          },
          {
            onProgress: ({ message }) => setState({ phase: 'submitting', message }),
          },
        );

        setState({ phase: 'polling', message: 'In queue — waiting for the judge…' });
        const result = await pollVerdict({
          contestId: problem.contestId,
          problemIndex: problem.problemIndex,
          submissionId: outcome.submissionId,
          since,
          onUpdate: (partial) => setState({ phase: 'polling', result: partial }),
        });
        const s = { phase: 'done', result };
        setState(s);
        return s;
      } catch (e) {
        const s = {
          phase: 'error',
          error: e instanceof Error ? e.message : String(e),
        };
        setState(s);
        return s;
      }
    },
    [problem],
  );

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, submit, reset };
}
