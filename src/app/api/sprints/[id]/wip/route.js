import { NextResponse } from 'next/server';
import { jsonError, withAdmin, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getSprintId(context) {
  const params = await context.params;
  return params.id;
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const sprintId = await getSprintId(context);
  const limits = db.prepare('SELECT status, max_count FROM sprint_wip_limits WHERE sprint_id = ?').all(sprintId);
  return NextResponse.json({ limits });
});

export const PUT = withAdmin(async (request, _user, context) => {
  const db = getDb();
  const sprintId = await getSprintId(context);
  const { limits } = await request.json();
  if (!Array.isArray(limits)) return jsonError('limits must be an array.');
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sprint_wip_limits WHERE sprint_id = ?').run(sprintId);
    for (const { status, max_count } of limits) {
      if (max_count > 0) {
        db.prepare('INSERT INTO sprint_wip_limits (sprint_id, status, max_count) VALUES (?, ?, ?)').run(sprintId, status, max_count);
      }
    }
  });
  tx();
  return NextResponse.json({ ok: true });
});
