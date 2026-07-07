/** Prompt builders for the AI hint panel. Kept separate from transport logic. */

const SYSTEM =
  'You are an expert competitive programming coach. Be concise, correct, and ' +
  'progressive: never reveal the full solution unless explicitly asked. Prefer ' +
  'nudges over answers. Use markdown and LaTeX ($...$) for math.';

function problemContext(p) {
  return [
    `Title: ${p.title}`,
    `Rating: ${p.rating ?? 'unknown'}`,
    `Tags: ${p.tags.join(', ') || 'none'}`,
    `Time limit: ${p.timeLimit}, Memory limit: ${p.memoryLimit}`,
    '',
    'Statement:',
    stripHtml(p.statement),
    '',
    'Input:',
    stripHtml(p.inputSpecification),
    '',
    'Output:',
    stripHtml(p.outputSpecification),
  ].join('\n');
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 4000);
}

export function buildPrompt(input) {
  const ctx = problemContext(input.problem);
  const code = input.code
    ? `\n\nUser's current ${input.language ?? ''} code:\n\`\`\`\n${input.code}\n\`\`\``
    : '';

  let task;
  switch (input.action) {
    case 'first-hint':
      task =
        'Give the FIRST, gentlest hint. One or two sentences pointing at the key observation. Do NOT describe the algorithm fully.';
      break;
    case 'next-hint':
      task = `Give hint number ${(input.hintLevel ?? 1) + 1}, slightly more revealing than the last but still not a full solution.`;
      break;
    case 'explain-editorial':
      task =
        'Explain the intended approach / editorial at a high level: key idea, algorithm, and complexity. Then outline implementation steps.';
      break;
    case 'explain-code':
      task =
        "Explain what the user's code does step by step, and whether it correctly solves the problem.";
      break;
    case 'find-bug':
      task =
        "Review the user's code for bugs, edge cases, and correctness issues. Point out specific fixes.";
      break;
    case 'time-complexity':
      task =
        "Analyze the time complexity of the user's code (or the intended approach if no code). Explain the reasoning with Big-O.";
      break;
    case 'space-complexity':
      task =
        "Analyze the space complexity of the user's code (or the intended approach if no code). Explain the reasoning with Big-O.";
      break;
    default:
      task = 'Provide a helpful hint.';
  }

  return {
    system: SYSTEM,
    prompt: `${task}\n\n---\n${ctx}${code}`,
  };
}

export const HINT_ACTIONS = [
  { action: 'first-hint', label: 'First Hint', icon: '💡' },
  { action: 'next-hint', label: 'Next Hint', icon: '➡️' },
  { action: 'explain-editorial', label: 'Explain Editorial', icon: '📖' },
  { action: 'explain-code', label: 'Explain My Code', icon: '🔍' },
  { action: 'find-bug', label: 'Find Bug', icon: '🐛' },
  { action: 'time-complexity', label: 'Time Complexity', icon: '⏱️' },
  { action: 'space-complexity', label: 'Space Complexity', icon: '💾' },
];
