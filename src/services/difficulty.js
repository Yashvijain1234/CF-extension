/**
 * Map a Codeforces numeric rating to a LeetCode-style difficulty bucket.
 *  - Easy:   < 1200
 *  - Medium: 1200 – 1899
 *  - Hard:   >= 1900
 */
export function ratingToDifficulty(rating) {
  if (rating == null) return 'unknown';
  if (rating < 1200) return 'easy';
  if (rating < 1900) return 'medium';
  return 'hard';
}

export const DIFFICULTY_LABEL = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  unknown: 'Unrated',
};

export const DIFFICULTY_COLOR = {
  easy: '#00b8a3',
  medium: '#ffb800',
  hard: '#ff375f',
  unknown: '#8a8a8a',
};
