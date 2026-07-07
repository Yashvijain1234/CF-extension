import { useCallback, useState } from 'react';
import { LANGUAGES } from '@/api/languages';
import { isLoggedIn, pollVerdict, submitSolution } from '@/services/pageBridge';

/**
 * Drives the submit → poll → verdict flow entirely from the content-script
 * context (reusing the logged-in Codeforces session), and reports the final
 * result to the caller (used to trigger the GitHub push prompt).
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
      if (!isLoggedIn()) {
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

      setState({ phase: 'submitting' });
      const since = Math.floor(Date.now() / 1000);
      try {
        const outcome = await submitSolution({
          contestId: problem.contestId,
          problemIndex: problem.problemIndex,
          languageId: LANGUAGES[language].cfId,
          source,
          isGym: problem.url.includes('/gym/'),
        });
        if (!outcome.queued) {
          const s = {
            phase: 'error',
            error: outcome.error ?? 'Submission was rejected by Codeforces.',
          };
          setState(s);
          return s;
        }

        setState({ phase: 'polling' });
        const result = await pollVerdict({
          contestId: problem.contestId,
          problemIndex: problem.problemIndex,
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
