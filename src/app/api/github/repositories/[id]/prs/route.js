import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getId(context) {
  const params = await context.params;
  return params.id;
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
  const where = ['gpr.repo_id = ?', "gpr.state = 'open'"];
  const whereArgs = [id];

  if (q) {
    where.push('(gpr.title LIKE ? OR CAST(gpr.number AS TEXT) LIKE ? OR gpr.author_login LIKE ?)');
    whereArgs.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const prs = db.prepare(`
    SELECT gpr.*,
      CASE WHEN tpr.pr_number IS NULL THEN 0 ELSE 1 END AS linked
    FROM github_pull_requests gpr
    LEFT JOIN ticket_pull_requests tpr
      ON tpr.ticket_id = ? AND tpr.repo_id = gpr.repo_id AND tpr.pr_number = gpr.number
    WHERE ${where.join(' AND ')}
    ORDER BY gpr.created_at DESC, gpr.number DESC
    LIMIT ?
  `).all(...args, ...whereArgs.slice(1), limit);

  return NextResponse.json({ prs });
});
