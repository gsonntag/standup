import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAdmin, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));
}

export const GET = withAuth(async () => {
  const db = getDb();
  const sprints = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) AS ticket_count,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'done') AS done_count,
      (SELECT COALESCE(SUM(total_points), 0) FROM tickets WHERE sprint_id = s.id) AS total_points,
      (SELECT COALESCE(SUM(CASE WHEN status = 'done' THEN 0 ELSE points_remaining END), 0) FROM tickets WHERE sprint_id = s.id) AS points_remaining
    FROM sprints s
    ORDER BY start_date DESC
  `).all();
  return NextResponse.json({ sprints });
});

export const POST = withAdmin(async (request) => {
  const db = getDb();
  const { name, start_date: startDate, end_date: endDate } = await request.json();
  if (!name?.trim()) return jsonError('Name is required.');
  if (!validDate(startDate) || !validDate(endDate)) return jsonError('Valid start and end dates are required.');
  if (new Date(endDate) <= new Date(startDate)) return jsonError('End date must be after start date.');

  const id = uuidv4();
  db.prepare('INSERT INTO sprints (id, name, start_date, end_date) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), startDate, endDate);
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  return NextResponse.json({ sprint: { ...sprint, ticket_count: 0, done_count: 0, total_points: 0, points_remaining: 0 } }, { status: 201 });
});
