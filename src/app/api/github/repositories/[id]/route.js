import { NextResponse } from 'next/server';
import { jsonError, withAdmin } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const DELETE = withAdmin(async (_request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  const repo = db.prepare('SELECT id FROM github_repositories WHERE id = ?').get(id);
  if (!repo) return jsonError('GitHub repository not found.', 404);

  db.prepare('DELETE FROM github_repositories WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
});

