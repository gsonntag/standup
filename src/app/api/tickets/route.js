import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { PRIORITIES } from '@/lib/constants';

const PRIORITY_VALUES = new Set(PRIORITIES.map((p) => p.value));

export function attachLabels(db, tickets) {
  if (!tickets.length) return tickets;
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(',');
  const labelRows = db.prepare(`
    SELECT tl.ticket_id, l.id, l.name, l.color
    FROM ticket_labels tl
    JOIN labels l ON l.id = tl.label_id
    WHERE tl.ticket_id IN (${placeholders})
    ORDER BY l.name ASC
  `).all(...ticketIds);
  const labelsByTicket = new Map();
  for (const row of labelRows) {
    if (!labelsByTicket.has(row.ticket_id)) labelsByTicket.set(row.ticket_id, []);
    labelsByTicket.get(row.ticket_id).push({
      id: row.id,
      name: row.name,
      color: row.color,
    });
  }
  return tickets.map((ticket) => ({
    ...ticket,
    labels: labelsByTicket.get(ticket.id) || [],
  }));
}

export function getTicketById(db, id) {
  const ticket = db.prepare(`
    SELECT t.*,
      assignee.username AS assignee_username,
      creator.username AS creator_username,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (
        SELECT COUNT(*)
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      ) AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    JOIN users creator ON creator.id = t.creator_id
    WHERE t.id = ?
  `).get(id);
  if (!ticket) return null;
  return attachLabels(db, [ticket])[0];
}

export const GET = withAuth(async (request) => {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const where = [];
  const args = [];

  if (searchParams.has('sprint_id')) {
    const sprintId = searchParams.get('sprint_id');
    if (sprintId === 'none') {
      where.push('t.sprint_id IS NULL');
    } else {
      where.push('t.sprint_id = ?');
      args.push(sprintId);
    }
  }
  if (searchParams.has('status')) {
    where.push('t.status = ?');
    args.push(searchParams.get('status'));
  }
  if (searchParams.has('assignee_id')) {
    where.push('t.assignee_id = ?');
    args.push(searchParams.get('assignee_id'));
  }

  const tickets = db.prepare(`
    SELECT t.*,
      assignee.username AS assignee_username,
      creator.username AS creator_username,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (
        SELECT COUNT(*)
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      ) AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    JOIN users creator ON creator.id = t.creator_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY t.sort_order ASC, t.created_at DESC
  `).all(...args);

  return NextResponse.json({ tickets: attachLabels(db, tickets) });
});

export const POST = withAuth(async (request, user) => {
  const db = getDb();
  const body = await request.json();
  const title = body.title?.trim();
  const priority = body.priority || 'medium';
  const sprintId = body.sprint_id || null;
  const assigneeId = body.assignee_id || null;

  if (!title) return jsonError('Title is required.');
  if (!PRIORITY_VALUES.has(priority)) return jsonError('Invalid priority.');
  if (sprintId && !db.prepare('SELECT id FROM sprints WHERE id = ?').get(sprintId)) {
    return jsonError('Sprint not found.', 404);
  }
  if (assigneeId && !db.prepare('SELECT id FROM users WHERE id = ?').get(assigneeId)) {
    return jsonError('Assignee not found.', 404);
  }

  const id = uuidv4();
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tickets').get().next;
  db.prepare(`
    INSERT INTO tickets (id, number, title, description, priority, sort_order, sprint_id, assignee_id, creator_id)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, body.description || '', priority, sortOrder, sprintId, assigneeId, user.id);

  return NextResponse.json({ ticket: getTicketById(db, id) }, { status: 201 });
});
