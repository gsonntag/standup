import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api';
import { getDb } from '@/lib/db';

export const GET = withAdmin(async (request) => {
  const db = getDb();
  const { searchParams } = new URL(request.url);

  const sprintId = searchParams.get('sprint_id')
    || db.prepare("SELECT id FROM sprints WHERE status = 'active' LIMIT 1").get()?.id
    || null;

  const sprint = sprintId
    ? db.prepare('SELECT * FROM sprints WHERE id = ?').get(sprintId)
    : null;

  if (!sprint) {
    return NextResponse.json({ sprint: null, members: [] });
  }

  const members = db.prepare(`
    SELECT
      u.id,
      u.username,
      COUNT(t.id) AS total_tickets,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done,
      COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
      COALESCE(SUM(CASE WHEN t.status = 'in_review' THEN 1 ELSE 0 END), 0) AS in_review,
      COALESCE(SUM(t.total_points), 0) AS total_points,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN t.total_points ELSE 0 END), 0) AS points_done
    FROM users u
    LEFT JOIN tickets t ON t.assignee_id = u.id AND t.sprint_id = ?
    GROUP BY u.id, u.username
    ORDER BY points_done DESC, done DESC, u.username ASC
  `).all(sprint.id);

  return NextResponse.json({ sprint, members });
});
