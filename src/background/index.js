/**
 * Background service worker (MV3).
 *
 * Central message router for privileged operations that must live outside page
 * contexts: GitHub OAuth + API calls and AI provider completions. Keeps access
 * tokens and API keys away from the Codeforces page.
 */

import { getSettings } from '@/storage';
import {
  connectWithOAuth,
  createRepository,
  disconnect,
  getRepos,
  pushSolution,
} from '@/github/service';
import { getUser } from '@/github/client';
import { runCompletion } from '@/services/ai/providers';

async function handle(request) {
  switch (request.type) {
    case 'GITHUB_CONNECT': {
      const github = await connectWithOAuth();
      return { username: github.username };
    }
    case 'GITHUB_DISCONNECT':
      await disconnect();
      return { ok: true };
    case 'GITHUB_GET_USER': {
      const { github } = await getSettings();
      if (!github.token) throw new Error('Not connected.');
      const user = await getUser(github.token);
      return { login: user.login, avatarUrl: user.avatar_url };
    }
    case 'GITHUB_LIST_REPOS': {
      const repos = await getRepos();
      return repos.map((r) => ({
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
      }));
    }
    case 'GITHUB_CREATE_REPO': {
      const repo = await createRepository(request.name, request.isPrivate);
      return { fullName: repo.full_name, defaultBranch: repo.default_branch };
    }
    case 'GITHUB_PUSH_SOLUTION':
      return pushSolution(request.payload);
    case 'OPEN_OPTIONS':
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    case 'AI_COMPLETE': {
      const { ai } = await getSettings();
      const text = await runCompletion(ai, {
        system: request.system ?? '',
        prompt: request.prompt,
      });
      return { text };
    }
    default:
      throw new Error(`Unknown request: ${request.type}`);
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handle(request)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  // Return true to keep the message channel open for the async response.
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'src/options/index.html' }).catch(() => {});
  }
});
