/**
 * Thin, reusable GitHub REST API client.
 *
 * Stateless: every method takes the access token explicitly so the same client
 * can be used from the background worker, popup or options page. Higher-level
 * orchestration (folder layout, README generation, duplicate handling) lives in
 * {@link ./service}.
 */

const API = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'GitHubApiError';
  }
}

async function request(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GitHubApiError(
      data.message ?? `GitHub API error (${res.status})`,
      res.status,
    );
  }
  return data;
}

export async function getUser(token) {
  return request(token, '/user');
}

export async function listRepos(token) {
  return request(
    token,
    '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
  );
}

export async function createRepo(token, name, isPrivate) {
  return request(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description: 'Codeforces solutions synced by Codeforces LeetMode.',
    }),
  });
}

/** Returns the file sha if it exists, otherwise null. */
export async function getFileSha(token, repo, path, branch) {
  try {
    const data = await request(
      token,
      `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`,
    );
    const content =
      data.encoding === 'base64'
        ? decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))))
        : data.content;
    return { sha: data.sha, content };
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return null;
    throw err;
  }
}

/** UTF-8 safe base64 encode for file contents. */
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export async function putFile(token, repo, path, branch, content, message, sha) {
  await request(
    token,
    `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: toBase64(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );
}
