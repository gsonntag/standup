import { NextResponse } from 'next/server';
import { jsonError, withAdmin } from '@/lib/api';
import { getDb } from '@/lib/db';
import { SPRINT_STATUSES } from '@/lib/constants';
import { publish } from '@/lib/events';

const STATUS_VALUES = new Set(SPRINT_STATUSES.map((s) => s.value));

async function getId(context) {
  const params = await context.params;
  return params.id;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));
}

export const PATCH = withAdmin(async (request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  if (!sprint) return jsonError('Sprint not found.', 404);

  const body = await request.json();
  const sets = [];
  const args = [];

  if ('name' in body) {
    if (!body.name?.trim()) return jsonError('Name is required.');
    sets.push('name = ?');
    args.push(body.name.trim());
  }
  if ('status' in body) {
    if (!STATUS_VALUES.has(body.status)) return jsonError('Invalid status.');
    if (body.status === 'active') {
      const active = db.prepare("SELECT id FROM sprints WHERE status = 'active' AND id != ?").get(id);
      if (active) return jsonError('Another sprint is already active.');
    }
    sets.push('status = ?');
    args.push(body.status);
  }
  if ('start_date' in body) {
    if (!validDate(body.start_date)) return jsonError('Valid start date is required.');
    sets.push('start_date = ?');
    args.push(body.start_date);
  }
  if ('end_date' in body) {
    if (!validDate(body.end_date)) return jsonError('Valid end date is required.');
    sets.push('end_date = ?');
    args.push(body.end_date);
  }

  const nextStart = body.start_date || sprint.start_date;
  const nextEnd = body.end_date || sprint.end_date;
  if (new Date(nextEnd) <= new Date(nextStart)) return jsonError('End date must be after start date.');
  if (!sets.length) return NextResponse.json({ sprint });

  let targetSprintId = null;
  if (body.status === 'completed') {
    const rolloverTo = body.rollover_to || 'backlog';
    if (rolloverTo !== 'backlog') {
      if (rolloverTo === 'next_planning') {
        const nextSprint = db.prepare("SELECT id FROM sprints WHERE status = 'planning' AND id != ? ORDER BY created_at ASC LIMIT 1").get(id);
        targetSprintId = nextSprint?.id || null;
      } else {
        const targetSprint = db.prepare("SELECT id FROM sprints WHERE id = ? AND status = 'planning'").get(rolloverTo);
        if (!targetSprint) return jsonError('Target sprint not found or not in planning.', 400);
        targetSprintId = rolloverTo;
      }
    }
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`).run(...args, id);
    if (body.status === 'completed') {
      if (targetSprintId) {
        db.prepare("UPDATE tickets SET sprint_id = ?, status = 'todo' WHERE sprint_id = ? AND status != 'done'").run(targetSprintId, id);
      } else {
        db.prepare("UPDATE tickets SET sprint_id = NULL, status = 'backlog' WHERE sprint_id = ? AND status != 'done'").run(id);
      }
    }
  });
  tx();

  publish({ kind: 'sprint', id, action: body.status || 'updated' });
  return NextResponse.json({ sprint: db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) });
});

export const DELETE = withAdmin(async (_request, _user, context) => {
  const db = getDb();
  const id = await getId(context);
  db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
});
