import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { getTicketById } from '../route';

const STATUS_VALUES = new Set(STATUSES.map((s) => s.value));
const PRIORITY_VALUES = new Set(PRIORITIES.map((p) => p.value));
const FIELD_LABELS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  sprint_id: 'sprint',
  assignee_id: 'assignee',
  sort_order: 'sort order',
};

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  const ticket = getTicketById(db, id);
  if (!ticket) return jsonError('Ticket not found.', 404);

  ticket.blockers = db.prepare(`
    SELECT t.id, t.number, t.title, t.status
    FROM ticket_dependencies td
    JOIN tickets t ON t.id = td.depends_on_id
    WHERE td.ticket_id = ?
    ORDER BY t.number ASC
  `).all(id);
  ticket.unblocks = db.prepare(`
    SELECT t.id, t.number, t.title, t.status
    FROM ticket_dependencies td
    JOIN tickets t ON t.id = td.ticket_id
    WHERE td.depends_on_id = ?
    ORDER BY t.number ASC
  `).all(id);

  return NextResponse.json({ ticket });
});

export const PATCH = withAuth(async (request, user, context) => {
  const db = getDb();
  const id = await getId(context);
  const existing = getTicketById(db, id);
  if (!existing) return jsonError('Ticket not found.', 404);

  const body = await request.json();
  const allowed = ['title', 'description', 'status', 'priority', 'sprint_id', 'assignee_id', 'sort_order'];
  const sets = [];
  const args = [];
  const changedFields = [];

  for (const field of allowed) {
    if (!(field in body)) continue;
    let value = body[field];
    if (field === 'title') {
      value = value?.trim();
      if (!value) return jsonError('Title is required.');
    }
    if (field === 'status' && !STATUS_VALUES.has(value)) return jsonError('Invalid status.');
    if (field === 'priority' && !PRIORITY_VALUES.has(value)) return jsonError('Invalid priority.');
    if (field === 'sprint_id') {
      value = value || null;
      if (value && !db.prepare('SELECT id FROM sprints WHERE id = ?').get(value)) {
        return jsonError('Sprint not found.', 404);
      }
    }
    if (field === 'assignee_id') {
      value = value || null;
      if (value && !db.prepare('SELECT id FROM users WHERE id = ?').get(value)) {
        return jsonError('Assignee not found.', 404);
      }
    }
    const previousValue = existing[field] ?? null;
    if (value !== previousValue) changedFields.push(FIELD_LABELS[field]);
    sets.push(`${field} = ?`);
    args.push(value);
  }

  if (!sets.length) return NextResponse.json({ ticket: getTicketById(db, id) });
  sets.push("updated_at = datetime('now')");
  args.push(id);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    if (changedFields.length && existing.creator_id !== user.id) {
      db.prepare('INSERT INTO comments (id, content, ticket_id, author_id) VALUES (?, ?, ?, ?)')
        .run(
          uuidv4(),
          `${user.username} edited this ticket at ${new Date().toISOString()}.\nChanged: ${changedFields.join(', ')}.`,
          id,
          user.id
        );
    }
  });
  tx();
  return NextResponse.json({ ticket: getTicketById(db, id) });
});

export const DELETE = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
});
