import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

function serializeCommit(row) {
  let branches = [];
  try {
    branches = JSON.parse(row.branches_json || '[]');
  } catch (_) {}
  return {
    sha: row.sha,
    short_sha: row.sha.slice(0, 7),
    message: row.message,
    author_name: row.author_name,
    author_login: row.author_login,
    committed_at: row.committed_at,
    html_url: row.html_url,
    branches,
    linked: Boolean(row.linked),
  };
}

export const GET = withAuth(async (request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  const repo = db.prepare('SELECT id FROM github_repositories WHERE id = ?').get(id);
  if (!repo) return jsonError('GitHub repository not found.', 404);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const q = searchParams.get('q')?.trim();
  const ticketId = searchParams.get('ticket_id');
  const args = [ticketId || '', id];
  const where = ['gc.repo_id = ?'];
  const whereArgs = [id];

  if (q) {
    where.push('(gc.message LIKE ? OR gc.sha LIKE ? OR gc.author_name LIKE ? OR gc.author_login LIKE ?)');
    whereArgs.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const commits = db.prepare(`
    SELECT gc.*,
      CASE WHEN tc.sha IS NULL THEN 0 ELSE 1 END AS linked
    FROM github_commits gc
    LEFT JOIN ticket_commits tc
      ON tc.ticket_id = ? AND tc.repo_id = gc.repo_id AND tc.sha = gc.sha
    WHERE ${where.join(' AND ')}
    ORDER BY gc.committed_at DESC, gc.sha ASC
    LIMIT ?
  `).all(...args, ...whereArgs.slice(1), limit).map(serializeCommit);

  return NextResponse.json({ commits });
});

