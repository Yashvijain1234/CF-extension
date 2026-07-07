/**
 * Codeforces problem parser.
 *
 * Converts the live Codeforces DOM into a normalized {@link ParsedProblem}.
 * The parser is defensive: Codeforces markup varies across old/new problems,
 * contests and gyms, so every extraction has a fallback.
 */

import { detectProblem } from './detect';
import { cleanSectionHtml, extractFormulas, absolutizeUrl } from './html';

function text(el) {
  return (el?.textContent ?? '').trim();
}

/** Extract the literal text of a <pre> sample, handling new line-wrapped DOM. */
function extractPreText(pre) {
  if (!pre) return '';
  const lines = pre.querySelectorAll('.test-example-line');
  if (lines.length > 0) {
    return Array.from(lines)
      .map((l) => l.textContent ?? '')
      .join('\n')
      .replace(/\n+$/, '');
  }
  // `innerText` preserves <br> line breaks better than textContent.
  const raw = pre.innerText ?? pre.textContent ?? '';
  return raw.replace(/\n+$/, '');
}

function parseSamples(root) {
  const samples = [];
  const tests = root.querySelectorAll('.sample-test');
  tests.forEach((test) => {
    const inputs = test.querySelectorAll('.input pre');
    const outputs = test.querySelectorAll('.output pre');
    const count = Math.max(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      samples.push({
        index: samples.length + 1,
        input: extractPreText(inputs[i] ?? null),
        output: extractPreText(outputs[i] ?? null),
      });
    }
  });
  return samples;
}

function parseTagsAndRating() {
  const tags = [];
  let rating = null;
  document.querySelectorAll('.sidebar .tag-box, .roundbox .tag-box').forEach((box) => {
    const t = text(box);
    if (!t) return;
    const ratingMatch = t.match(/^\*?(\d{3,4})$/);
    if (ratingMatch) {
      rating = parseInt(ratingMatch[1], 10);
    } else {
      tags.push(t);
    }
  });
  return { tags: Array.from(new Set(tags)), rating };
}

function parseImages(root) {
  const images = [];
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src)
      images.push({ src: absolutizeUrl(src), alt: img.getAttribute('alt') ?? undefined });
  });
  return images;
}

/** Heuristic: pull bounded-quantity lines that look like constraints. */
function parseConstraints(inputSpecNode) {
  if (!inputSpecNode) return [];
  const raw = text(inputSpecNode);
  const matches = raw.match(/[^.]*?(?:\\le|\\leq|≤|<=|<)[^.]*\./g) ?? [];
  return matches
    .map((m) => m.trim())
    .filter((m) => m.length < 200)
    .slice(0, 12);
}

export function parseProblem(locator) {
  const loc = locator ?? detectProblem();
  if (!loc) return null;

  const statementRoot = document.querySelector('.problem-statement');
  if (!statementRoot) return null;

  const header = statementRoot.querySelector('.header');
  const titleRaw = text(header?.querySelector('.title'));
  // Title format: "A. Way Too Long Words" -> strip the index prefix.
  const title = titleRaw.replace(/^[A-Za-z0-9]+\.\s*/, '') || titleRaw;

  const timeLimit = text(header?.querySelector('.time-limit'))
    .replace(/time limit per test/i, '')
    .trim();
  const memoryLimit = text(header?.querySelector('.memory-limit'))
    .replace(/memory limit per test/i, '')
    .trim();

  // The main statement is the first bare <div> after the header block.
  let statementNode = null;
  const children = Array.from(statementRoot.children);
  const headerIdx = children.findIndex((c) => c.classList.contains('header'));
  for (let i = headerIdx + 1; i < children.length; i++) {
    const c = children[i];
    if (!c.className) {
      statementNode = c;
      break;
    }
  }

  const inputSpecNode = statementRoot.querySelector('.input-specification');
  const outputSpecNode = statementRoot.querySelector('.output-specification');
  const noteNode = statementRoot.querySelector('.note');
  const sampleRoot = statementRoot.querySelector('.sample-tests') ?? statementRoot;

  const { tags, rating } = parseTagsAndRating();

  const formulas = [
    ...extractFormulas(statementNode),
    ...extractFormulas(inputSpecNode),
    ...extractFormulas(outputSpecNode),
  ];

  return {
    contestId: loc.contestId,
    problemIndex: loc.problemIndex,
    title,
    rating,
    tags,
    timeLimit: timeLimit || 'N/A',
    memoryLimit: memoryLimit || 'N/A',
    statement: cleanSectionHtml(statementNode),
    inputSpecification: cleanSectionHtml(inputSpecNode),
    outputSpecification: cleanSectionHtml(outputSpecNode),
    note: cleanSectionHtml(noteNode),
    samples: parseSamples(sampleRoot),
    images: parseImages(statementRoot),
    formulas: Array.from(new Set(formulas)),
    constraints: parseConstraints(inputSpecNode),
    url: loc.url,
    key: loc.key,
    parsedAt: Date.now(),
  };
}

export { detectProblem, detectCodeforcesTheme } from './detect';
