import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getIds(context) {
  const params = await context.params;
  return { ticketId: params.id, userId: params.userId };
}

export const DELETE = withAuth(async (_request, user, context) => {
  const db = getDb();
  const { ticketId, userId } = await getIds(context);
  if (userId !== user.id && user.role !== 'admin') return jsonError('Forbidden.', 403);
  db.prepare('DELETE FROM ticket_watchers WHERE ticket_id = ? AND user_id = ?').run(ticketId, userId);
  return NextResponse.json({ ok: true });
});
