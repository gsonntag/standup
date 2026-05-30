import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { getTicketById } from '../route';
import { publish } from '@/lib/events';

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
  due_date: 'due date',
  total_points: 'total points',
  points_remaining: 'points remaining',
  github_repo_id: 'repository',
};

function parsePositiveInteger(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return { error: `${field} must be a positive integer.` };
  }
  return parsed;
}

function parseNonNegativeInteger(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { error: `${field} must be zero or a positive integer.` };
  }
  return parsed;
}

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

  ticket.events = db.prepare(`
    SELECT te.*, u.username AS actor_username
    FROM ticket_events te
    JOIN users u ON u.id = te.actor_id
    WHERE te.ticket_id = ?
    ORDER BY te.created_at ASC
  `).all(id);

  ticket.attachments = db.prepare(`
    SELECT ta.*, u.username AS uploader_username
    FROM ticket_attachments ta
    JOIN users u ON u.id = ta.uploader_id
    WHERE ta.ticket_id = ?
    ORDER BY ta.created_at ASC
  `).all(id);

  ticket.watchers = db.prepare(`
    SELECT u.id, u.username
    FROM ticket_watchers tw
    JOIN users u ON u.id = tw.user_id
    WHERE tw.ticket_id = ?
    ORDER BY u.username ASC
  `).all(id);

  return NextResponse.json({ ticket });
});

export const PATCH = withAuth(async (request, user, context) => {
  const db = getDb();
  const id = await getId(context);
  const existing = getTicketById(db, id);
  if (!existing) return jsonError('Ticket not found.', 404);

  const body = await request.json();
  if ('story_points' in body && !('total_points' in body)) {
    body.total_points = body.story_points;
  }
  const allowed = ['title', 'description', 'status', 'priority', 'sprint_id', 'assignee_id', 'sort_order', 'due_date', 'total_points', 'points_remaining', 'github_repo_id'];
  const sets = [];
  const args = [];
  const changedFieldDetails = [];
  let nextTotalPoints = existing.total_points ?? null;
  let nextPointsRemaining = existing.points_remaining ?? null;
  let nextStatus = existing.status;

  for (const field of allowed) {
    if (!(field in body)) continue;
    let value = body[field];
    if (field === 'title') {
      value = value?.trim();
      if (!value) return jsonError('Title is required.');
    }
    if (field === 'status') {
      if (!STATUS_VALUES.has(value)) return jsonError('Invalid status.');
      nextStatus = value;
    }
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
    if (field === 'github_repo_id') {
      value = value || null;
      if (value && !db.prepare('SELECT id FROM github_repositories WHERE id = ?').get(value)) {
        return jsonError('GitHub repository not found.', 404);
      }
    }
    if (field === 'due_date') {
      value = value || null;
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return jsonError('Invalid due_date format. Use YYYY-MM-DD.');
    }
    if (field === 'total_points') {
      value = parsePositiveInteger(value, 'total_points');
      if (value?.error) return jsonError(value.error);
      nextTotalPoints = value;
    }
    if (field === 'points_remaining') {
      value = parseNonNegativeInteger(value, 'points_remaining');
      if (value?.error) return jsonError(value.error);
      nextPointsRemaining = value;
    }
    const previousValue = existing[field] ?? null;
    if (value !== previousValue) {
      changedFieldDetails.push({ field: FIELD_LABELS[field], oldValue: previousValue, newValue: value });
    }
    sets.push(`${field} = ?`);
    args.push(value);
  }

  if ('total_points' in body && !('points_remaining' in body)) {
    if (nextTotalPoints == null) {
      nextPointsRemaining = null;
    } else if (nextStatus === 'done') {
      nextPointsRemaining = 0;
    } else if (nextPointsRemaining == null || nextPointsRemaining > nextTotalPoints) {
      nextPointsRemaining = nextTotalPoints;
    }
    const previousValue = existing.points_remaining ?? null;
    if (nextPointsRemaining !== previousValue) {
      changedFieldDetails.push({ field: FIELD_LABELS.points_remaining, oldValue: previousValue, newValue: nextPointsRemaining });
      sets.push('points_remaining = ?');
      args.push(nextPointsRemaining);
    }
  }

  if (nextStatus === 'done' && !('total_points' in body) && !('points_remaining' in body) && nextTotalPoints != null && nextPointsRemaining !== 0) {
    const previousValue = existing.points_remaining ?? null;
    nextPointsRemaining = 0;
    changedFieldDetails.push({ field: FIELD_LABELS.points_remaining, oldValue: previousValue, newValue: nextPointsRemaining });
    sets.push('points_remaining = ?');
    args.push(nextPointsRemaining);
  }

  if (nextPointsRemaining === 0 && nextStatus !== 'done' && nextStatus !== 'in_review') {
    const previousValue = existing.status ?? null;
    nextStatus = 'in_review';
    const statusSetIndex = sets.findIndex((set) => set === 'status = ?');
    const statusChangeIndex = changedFieldDetails.findIndex((detail) => detail.field === FIELD_LABELS.status);
    const statusChange = changedFieldDetails[statusChangeIndex];
    if (statusSetIndex === -1) {
      sets.push('status = ?');
      args.push(nextStatus);
    } else {
      args[statusSetIndex] = nextStatus;
    }
    if (statusChange) {
      statusChange.newValue = nextStatus;
      if (statusChange.oldValue === statusChange.newValue) {
        changedFieldDetails.splice(statusChangeIndex, 1);
      }
    } else {
      changedFieldDetails.push({ field: FIELD_LABELS.status, oldValue: previousValue, newValue: nextStatus });
    }
  }

  if (nextPointsRemaining != null && nextTotalPoints == null) {
    return jsonError('points_remaining requires total_points.');
  }
  if (nextPointsRemaining != null && nextTotalPoints != null && nextPointsRemaining > nextTotalPoints) {
    return jsonError('points_remaining cannot exceed total_points.');
  }

  if (!sets.length && !('position' in body)) return NextResponse.json({ ticket: getTicketById(db, id) });

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    args.push(id);
    const tx = db.transaction(() => {
      db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      for (const detail of changedFieldDetails) {
        db.prepare(
          `INSERT INTO ticket_events (id, ticket_id, actor_id, kind, field, old_value, new_value, created_at)
           VALUES (?, ?, ?, 'field_change', ?, ?, ?, datetime('now'))`
        ).run(
          uuidv4(),
          id,
          user.id,
          detail.field,
          detail.oldValue !== null ? String(detail.oldValue) : null,
          detail.newValue !== null ? String(detail.newValue) : null
        );
      }
      // Auto-add assignee as watcher
      if (body.assignee_id) {
        db.prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)')
          .run(id, body.assignee_id);
      }
      if ('github_repo_id' in body && (body.github_repo_id || null) !== (existing.github_repo_id || null)) {
        db.prepare('DELETE FROM ticket_commits WHERE ticket_id = ?').run(id);
      }
    });
    tx();
  }

  // Handle position-based ordering
  const { position } = body;
  if (position) {
    const targetSprintId = sets.some(s => s.startsWith('sprint_id')) ? (body.sprint_id || null) : existing.sprint_id;
    const targetStatus = sets.some(s => s.startsWith('status')) ? nextStatus : existing.status;

    const columnTickets = db.prepare(`
      SELECT id FROM tickets
      WHERE ${targetSprintId ? 'sprint_id = ?' : 'sprint_id IS NULL'}
      AND status = ?
      AND id != ?
      ORDER BY sort_order ASC, created_at DESC
    `).all(...(targetSprintId ? [targetSprintId] : []), targetStatus, id).map(r => r.id);

    let insertAt = columnTickets.length;
    if (position.before_id) {
      const idx = columnTickets.indexOf(position.before_id);
      if (idx !== -1) insertAt = idx;
    } else if (position.after_id) {
      const idx = columnTickets.indexOf(position.after_id);
      if (idx !== -1) insertAt = idx + 1;
    } else if (typeof position.index === 'number') {
      insertAt = Math.max(0, Math.min(position.index, columnTickets.length));
    }

    columnTickets.splice(insertAt, 0, id);

    const reorderTx = db.transaction(() => {
      columnTickets.forEach((ticketId, i) => {
        db.prepare('UPDATE tickets SET sort_order = ? WHERE id = ?').run((i + 1) * 1024, ticketId);
      });
    });
    reorderTx();
  }

  publish({ kind: 'ticket', id, action: 'updated' });
  return NextResponse.json({ ticket: getTicketById(db, id) });
});

export const DELETE = withAuth(async (_request, user, context) => {
  const db = getDb();
  const id = await getId(context);
  const ticket = db.prepare('SELECT creator_id FROM tickets WHERE id = ?').get(id);
  if (!ticket) return jsonError('Ticket not found.', 404);
  if (user.role !== 'admin' && ticket.creator_id !== user.id) {
    return jsonError('Only the ticket creator or an admin can delete this ticket.', 403);
  }
  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  publish({ kind: 'ticket', id, action: 'deleted' });
  return NextResponse.json({ ok: true });
});
