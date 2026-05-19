import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getTicketId(context) {
  const params = await context.params;
  return params.id;
}

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const ticketId = await getTicketId(context);
  if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId)) {
    return jsonError('Ticket not found.', 404);
  }
  const { user_id } = await request.json();
  const targetId = user_id || user.id;
  if (targetId !== user.id && user.role !== 'admin') return jsonError('Forbidden.', 403);
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(targetId)) {
    return jsonError('User not found.', 404);
  }
  db.prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)').run(ticketId, targetId);
  return NextResponse.json({ ok: true });
});
