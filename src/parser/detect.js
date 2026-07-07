/** Codeforces problem-page detection utilities. */

/**
 * Matches the three supported problem URL shapes:
 *  - /problemset/problem/{contestId}/{index}
 *  - /contest/{contestId}/problem/{index}
 *  - /gym/{contestId}/problem/{index}
 */
const PATTERNS = [
  { re: /\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/, isGym: false },
  { re: /\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/, isGym: false },
  { re: /\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/, isGym: true },
];

export function detectProblem(url = window.location.href) {
  const path = new URL(url).pathname;
  for (const { re, isGym } of PATTERNS) {
    const m = path.match(re);
    if (m) {
      const contestId = m[1];
      const problemIndex = m[2].toUpperCase();
      return {
        contestId,
        problemIndex,
        isGym,
        key: `${contestId}${problemIndex}`,
        url,
      };
    }
  }
  return null;
}

/** Detect the active Codeforces theme by inspecting the page. */
export function detectCodeforcesTheme() {
  // Codeforces stores the theme cookie; dark themes append a class or use a
  // data attribute on the body. Fall back to computed background luminance.
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const rgb = bodyBg.match(/\d+/g)?.map(Number);
  if (rgb && rgb.length >= 3) {
    const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return luminance < 128 ? 'dark' : 'light';
  }
  return 'light';
}
