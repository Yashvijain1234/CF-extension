/** README + folder-path generation for GitHub uploads (LeetHub-style). */

import { ratingToDifficulty, DIFFICULTY_LABEL } from '@/services/difficulty';

/** Turn a title into a filesystem-friendly slug: "Way Too Long Words" -> "Way_Too_Long_Words". */
export function slugifyTitle(title) {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/** Folder name: `71A_Way_Too_Long_Words`. */
export function problemFolder(problem) {
  const id = `${problem.contestId ?? 'X'}${problem.problemIndex}`;
  return `${id}_${slugifyTitle(problem.title)}`;
}

/** Full repo path for a solution file, e.g. `Codeforces/71A_.../solution.cpp`. */
export function solutionPath(problem, ext) {
  return `Codeforces/${problemFolder(problem)}/solution.${ext}`;
}

export function readmePath(problem) {
  return `Codeforces/${problemFolder(problem)}/README.md`;
}

export function buildReadme(problem, result, language, explanation) {
  const difficulty = DIFFICULTY_LABEL[ratingToDifficulty(problem.rating)];
  const date = new Date(result.creationTimeSeconds * 1000).toISOString().slice(0, 10);
  const tags = problem.tags.length ? problem.tags.map((t) => `\`${t}\``).join(', ') : '—';

  return `# ${problem.contestId ?? ''}${problem.problemIndex}. ${problem.title}

| Field | Value |
| --- | --- |
| **Contest ID** | ${problem.contestId ?? 'N/A'} |
| **Problem Index** | ${problem.problemIndex} |
| **URL** | [${problem.url}](${problem.url}) |
| **Rating** | ${problem.rating ?? 'Unrated'} (${difficulty}) |
| **Tags** | ${tags} |
| **Time Limit** | ${problem.timeLimit} |
| **Memory Limit** | ${problem.memoryLimit} |
| **Language** | ${language} |
| **Verdict** | ${result.verdict.replace(/_/g, ' ')} |
| **Runtime** | ${result.timeConsumedMs} ms |
| **Memory** | ${(result.memoryConsumedKb / 1024).toFixed(1)} MB |
| **Submitted** | ${date} |

## Explanation

${explanation?.trim() || '_Add your approach and reasoning here._'}

---
<sub>Synced automatically by <a href="https://github.com/">Codeforces LeetMode</a>.</sub>
`;
}
