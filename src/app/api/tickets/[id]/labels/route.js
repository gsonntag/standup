import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const POST = withAuth(async (request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const { label_id: labelId } = await request.json();
  if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId)) return jsonError('Ticket not found.', 404);
  if (!db.prepare('SELECT id FROM labels WHERE id = ?').get(labelId)) return jsonError('Label not found.', 404);
  db.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)').run(ticketId, labelId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const { label_id: labelId } = await request.json();
  db.prepare('DELETE FROM ticket_labels WHERE ticket_id = ? AND label_id = ?').run(ticketId, labelId);
  return NextResponse.json({ ok: true });
});
