import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { fetchRepositoryPullRequests, GitHubApiError } from '@/lib/github';

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
    const pulls = await fetchRepositoryPullRequests(repo.owner, repo.name);
    const fetchedAt = new Date().toISOString();

    const tx = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO github_pull_requests (
          repo_id, number, title, state, html_url, author_login,
          created_at, updated_at, merged_at, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(repo_id, number) DO UPDATE SET
          title = excluded.title,
          state = excluded.state,
          html_url = excluded.html_url,
          author_login = excluded.author_login,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          merged_at = excluded.merged_at,
          synced_at = datetime('now')
      `);

      for (const pr of pulls) {
        upsert.run(
          id,
          pr.number,
          pr.title,
          pr.state,
          pr.html_url,
          pr.author_login,
          pr.created_at,
          pr.updated_at,
          pr.merged_at
        );
      }

      // Mark any pull requests not returned as closed
      const openPrNumbers = pulls.map(pr => pr.number);
      if (openPrNumbers.length > 0) {
        const placeholders = openPrNumbers.map(() => '?').join(',');
        db.prepare(`
          UPDATE github_pull_requests
          SET state = 'closed', synced_at = datetime('now')
          WHERE repo_id = ? AND number NOT IN (${placeholders})
        `).run(id, ...openPrNumbers);
      } else {
        db.prepare(`
          UPDATE github_pull_requests
          SET state = 'closed', synced_at = datetime('now')
          WHERE repo_id = ?
        `).run(id);
      }

      db.prepare("UPDATE github_repositories SET updated_at = datetime('now') WHERE id = ?").run(id);
    });
    tx();

    return NextResponse.json({
      synced_count: pulls.length,
      fetched_at: fetchedAt,
    });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return jsonError(err.message, err.status);
    }
    return jsonError('Failed to sync GitHub pull requests.', 502);
  }
});
