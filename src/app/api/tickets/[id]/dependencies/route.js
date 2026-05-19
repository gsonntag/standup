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
  const { depends_on_id: dependsOnId } = await request.json();

  if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId)) return jsonError('Ticket not found.', 404);
  if (!dependsOnId) return jsonError('depends_on_id is required.');
  if (ticketId === dependsOnId) return jsonError('Ticket cannot depend on itself.');
  if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(dependsOnId)) return jsonError('Dependency ticket not found.', 404);

  // Check for cycles: would adding (ticketId depends_on dependsOnId) create a cycle?
  // Walk from dependsOnId following depends_on_id edges; if we reach ticketId, it's a cycle.
  const cycleCheck = db.prepare(`
    WITH RECURSIVE reach(id) AS (
      SELECT depends_on_id FROM ticket_dependencies WHERE ticket_id = ?
      UNION
      SELECT td.depends_on_id
      FROM ticket_dependencies td
      JOIN reach r ON td.ticket_id = r.id
    )
    SELECT 1 FROM reach WHERE id = ? LIMIT 1
  `).get(dependsOnId, ticketId);
  if (cycleCheck) return jsonError('Adding this dependency would create a cycle.', 409);

  db.prepare('INSERT OR IGNORE INTO ticket_dependencies (ticket_id, depends_on_id) VALUES (?, ?)')
    .run(ticketId, dependsOnId);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = withAuth(async (request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const { depends_on_id: dependsOnId } = await request.json();
  db.prepare('DELETE FROM ticket_dependencies WHERE ticket_id = ? AND depends_on_id = ?')
    .run(ticketId, dependsOnId);
  return NextResponse.json({ ok: true });
});
