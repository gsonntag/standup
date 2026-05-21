import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { fetchRepositoryCommitsAcrossBranches, GitHubApiError } from '@/lib/github';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const POST = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  const repo = db.prepare('SELECT * FROM github_repositories WHERE id = ?').get(id);
  if (!repo) return jsonError('GitHub repository not found.', 404);

  try {
    const { branch_count: branchCount, commits } = await fetchRepositoryCommitsAcrossBranches(repo.owner, repo.name);
    const fetchedAt = new Date().toISOString();

    const tx = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO github_commits (
          repo_id, sha, message, author_name, author_login, committed_at, html_url,
          branches_json, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(repo_id, sha) DO UPDATE SET
          message = excluded.message,
          author_name = excluded.author_name,
          author_login = excluded.author_login,
          committed_at = excluded.committed_at,
          html_url = excluded.html_url,
          branches_json = excluded.branches_json,
          synced_at = datetime('now')
      `);

      for (const commit of commits) {
        upsert.run(
          id,
          commit.sha,
          commit.message,
          commit.author_name,
          commit.author_login,
          commit.committed_at,
          commit.html_url,
          JSON.stringify(commit.branches)
        );
      }

      db.prepare("UPDATE github_repositories SET updated_at = datetime('now') WHERE id = ?").run(id);
    });
    tx();

    return NextResponse.json({
      synced_count: commits.length,
      branch_count: branchCount,
      fetched_at: fetchedAt,
    });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return jsonError(err.message, err.status);
    }
    return jsonError('Failed to sync GitHub commits.', 502);
  }
});

