const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GitHubApiError('GITHUB_TOKEN is not configured.', 400);
  }
  return token;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function githubRequest(pathOrUrl, params = {}) {
  const token = getToken();
  const url = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl, GITHUB_API_BASE);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'scrum-github-integration',
    },
  });

  if (!res.ok) {
    let message = `GitHub request failed with status ${res.status}.`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch (_) {}
    throw new GitHubApiError(message, res.status);
  }

  return {
    data: await res.json(),
    nextUrl: parseNextLink(res.headers.get('link')),
  };
}

async function githubPaginatedRequest(path, params = {}) {
  const items = [];
  let nextPath = path;
  let nextParams = { per_page: 100, ...params };

  while (nextPath) {
    const { data, nextUrl } = await githubRequest(nextPath, nextParams);
    items.push(...data);
    nextPath = nextUrl;
    nextParams = {};
  }

  return items;
}

export async function fetchRepository(owner, name) {
  const repo = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  return {
    owner: repo.data.owner?.login || owner,
    name: repo.data.name,
    default_branch: repo.data.default_branch || 'main',
    html_url: repo.data.html_url,
  };
}

export async function fetchRepositoryCommitsAcrossBranches(owner, name) {
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const branches = await githubPaginatedRequest(`${repoPath}/branches`);
  const commitsBySha = new Map();

  for (const branch of branches) {
    const branchCommits = await githubPaginatedRequest(`${repoPath}/commits`, { sha: branch.name });
    for (const item of branchCommits) {
      const committedAt = item.commit?.committer?.date || item.commit?.author?.date;
      if (!item.sha || !committedAt) continue;
      const existing = commitsBySha.get(item.sha);
      if (existing) {
        existing.branches.add(branch.name);
        continue;
      }
      commitsBySha.set(item.sha, {
        sha: item.sha,
        message: item.commit?.message || '',
        author_name: item.commit?.author?.name || null,
        author_login: item.author?.login || null,
        committed_at: committedAt,
        html_url: item.html_url,
        branches: new Set([branch.name]),
      });
    }
  }

  return {
    branch_count: branches.length,
    commits: Array.from(commitsBySha.values())
      .map((commit) => ({ ...commit, branches: Array.from(commit.branches).sort() }))
      .sort((a, b) => b.committed_at.localeCompare(a.committed_at) || a.sha.localeCompare(b.sha)),
  };
}

