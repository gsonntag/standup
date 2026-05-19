import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

export const DELETE = withAuth(async (_request, _user, context) => {
  const params = await context.params;
  getDb().prepare('DELETE FROM labels WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
});
