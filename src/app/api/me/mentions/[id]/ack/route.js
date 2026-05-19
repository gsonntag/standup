import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

export const POST = withAuth(async (_request, user, context) => {
  const db = getDb();
  const params = await context.params;
  db.prepare('UPDATE mentions SET acknowledged = 1 WHERE id = ? AND user_id = ?').run(params.id, user.id);
  return NextResponse.json({ ok: true });
});
