/**
 * High-level GitHub integration service.
 *
 * Handles authentication (OAuth via `chrome.identity` or Personal Access Token),
 * repository selection/creation, and the LeetHub-style push flow including
 * duplicate detection and README generation.
 *
 * Runs in the background service worker so tokens stay out of page contexts.
 */

import { getSettings, patchSettings } from '@/storage';
import { createRepo, getFileSha, getUser, listRepos, putFile } from './client';
import { buildReadme, readmePath, solutionPath } from './readme';

/**
 * Optional OAuth configuration. GitHub's web flow requires a client secret for
 * the token exchange, which cannot ship in a public extension. Provide your own
 * OAuth app client id and a token-exchange proxy URL to enable OAuth; otherwise
 * users authenticate with a fine-grained Personal Access Token (recommended).
 */
export const OAUTH_CONFIG = {
  clientId: '',
  scopes: 'repo',
  /** A backend endpoint that exchanges `code` for an access token. */
  tokenExchangeUrl: '',
};

async function persistConnection(patch) {
  const settings = await getSettings();
  const github = { ...settings.github, ...patch };
  await patchSettings({ github });
  return github;
}

/** Connect using a Personal Access Token (validates it against the API). */
export async function connectWithToken(token) {
  const user = await getUser(token);
  return persistConnection({
    connected: true,
    token,
    username: user.login,
  });
}

/**
 * Connect via GitHub OAuth using `chrome.identity.launchWebAuthFlow`.
 * Requires {@link OAUTH_CONFIG} to be filled in.
 */
export async function connectWithOAuth() {
  if (!OAUTH_CONFIG.clientId || !OAUTH_CONFIG.tokenExchangeUrl) {
    throw new Error(
      'OAuth is not configured. Add a client id + token-exchange URL in github/service.ts, or connect with a Personal Access Token.',
    );
  }
  const redirectUri = chrome.identity.getRedirectURL('github');
  const authUrl =
    `https://github.com/login/oauth/authorize?client_id=${OAUTH_CONFIG.clientId}` +
    `&scope=${encodeURIComponent(OAUTH_CONFIG.scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) throw new Error('Authorization was cancelled.');

  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) throw new Error('No authorization code returned by GitHub.');

  const exchange = await fetch(OAUTH_CONFIG.tokenExchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const { access_token: accessToken } = await exchange.json();
  if (!accessToken) throw new Error('Token exchange failed.');

  return connectWithToken(accessToken);
}

export async function disconnect() {
  return persistConnection({
    connected: false,
    token: null,
    username: null,
    repo: null,
  });
}

async function requireToken() {
  const { github } = await getSettings();
  if (!github.token) throw new Error('GitHub is not connected.');
  return github.token;
}

export async function getRepos() {
  const token = await requireToken();
  return listRepos(token);
}

export async function createRepository(name, isPrivate) {
  const token = await requireToken();
  const repo = await createRepo(token, name, isPrivate);
  await persistConnection({ repo: repo.full_name, branch: repo.default_branch });
  return repo;
}

/**
 * Push an accepted solution + README to the configured repository.
 * Honors the duplicate-handling strategy in the payload.
 */
export async function pushSolution(payload) {
  const { github } = await getSettings();
  if (!github.token) throw new Error('GitHub is not connected.');
  if (!github.repo) throw new Error('No repository selected. Choose one in Settings.');

  const { token, repo, branch } = github;
  const { problem, result, source, languageExt, explanation, onDuplicate } = payload;

  const codePath = solutionPath(problem, languageExt);
  const docPath = readmePath(problem);
  const existing = await getFileSha(token, repo, codePath, branch);

  if (existing && onDuplicate === 'skip') {
    return {
      action: 'skipped',
      solutionUrl: `https://github.com/${repo}/blob/${branch}/${codePath}`,
    };
  }

  const sha = existing?.sha;

  if (existing && onDuplicate === 'keep-history') {
    // Append the previous version as a timestamped history file.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const historyPath = codePath.replace(
      `solution.${languageExt}`,
      `history/solution_${stamp}.${languageExt}`,
    );
    await putFile(
      token,
      repo,
      historyPath,
      branch,
      existing.content,
      `history: snapshot previous solution for ${problem.key}`,
    );
  }

  const commitMsg = `${existing ? 'update' : 'add'}: ${problem.key} ${problem.title} [${result.verdict}]`;
  await putFile(token, repo, codePath, branch, source, commitMsg, sha);

  const readmeExisting = await getFileSha(token, repo, docPath, branch);
  await putFile(
    token,
    repo,
    docPath,
    branch,
    buildReadme(problem, result, payload.languageExt, explanation),
    `docs: ${problem.key} README`,
    readmeExisting?.sha,
  );

  return {
    action: existing ? 'updated' : 'created',
    solutionUrl: `https://github.com/${repo}/blob/${branch}/${codePath}`,
  };
}
