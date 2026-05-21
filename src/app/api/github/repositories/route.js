import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAdmin, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { fetchRepository, GitHubApiError } from '@/lib/github';

function normalizeRepoInput(body) {
  const fullName = body.full_name?.trim();
  if (fullName && fullName.includes('/')) {
    const [owner, name] = fullName.split('/');
    return { owner: owner?.trim(), name: name?.trim() };
  }
  return { owner: body.owner?.trim(), name: body.name?.trim() };
}

function serializeRepo(row) {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    full_name: `${row.owner}/${row.name}`,
    default_branch: row.default_branch,
    html_url: row.html_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const GET = withAuth(async () => {
  const repos = getDb().prepare(`
    SELECT *
    FROM github_repositories
    ORDER BY owner ASC, name ASC
  `).all().map(serializeRepo);
  return NextResponse.json({ repositories: repos });
});

export const POST = withAdmin(async (request) => {
  const db = getDb();
  const body = await request.json();
  const { owner, name } = normalizeRepoInput(body);

  if (!owner || !name) return jsonError('Repository owner and name are required.');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    return jsonError('Repository must be in owner/name format.');
  }

  try {
    const repo = await fetchRepository(owner, name);
    const existing = db.prepare('SELECT * FROM github_repositories WHERE owner = ? AND name = ?')
      .get(repo.owner, repo.name);
    if (existing) return NextResponse.json({ repository: serializeRepo(existing) });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO github_repositories (id, owner, name, default_branch, html_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, repo.owner, repo.name, repo.default_branch, repo.html_url);

    const created = db.prepare('SELECT * FROM github_repositories WHERE id = ?').get(id);
    return NextResponse.json({ repository: serializeRepo(created) }, { status: 201 });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return jsonError(err.message, err.status);
    }
    return jsonError('Failed to validate GitHub repository.', 502);
  }
});

