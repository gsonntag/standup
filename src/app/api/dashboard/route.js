import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const sprints = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) AS ticket_count,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'done') AS done_count,
      (SELECT COALESCE(SUM(total_points), 0) FROM tickets WHERE sprint_id = s.id) AS total_points,
      (SELECT COALESCE(SUM(CASE WHEN status = 'done' THEN 0 ELSE points_remaining END), 0) FROM tickets WHERE sprint_id = s.id) AS points_remaining
    FROM sprints s
    ORDER BY start_date DESC
  `).all();

  const sprintId = searchParams.get('sprint_id')
    || db.prepare("SELECT id FROM sprints WHERE status = 'active' LIMIT 1").get()?.id
    || sprints[0]?.id
    || null;

  const sprint = sprintId
    ? db.prepare('SELECT * FROM sprints WHERE id = ?').get(sprintId)
    : null;

  if (!sprint) {
    return NextResponse.json({ sprint: null, sprints, members: [], in_progress_tickets: [] });
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
    LEFT JOIN ticket_assignees ta ON ta.user_id = u.id
    LEFT JOIN tickets t ON t.id = ta.ticket_id AND t.sprint_id = ?
    GROUP BY u.id, u.username
    ORDER BY points_done DESC, done DESC, u.username ASC
  `).all(sprint.id);

  const inProgressTickets = db.prepare(`
    SELECT t.id, t.number, t.title, t.status, t.priority,
      GROUP_CONCAT(DISTINCT u.username) AS assignee_names
    FROM tickets t
    LEFT JOIN ticket_assignees ta ON ta.ticket_id = t.id
    LEFT JOIN users u ON u.id = ta.user_id
    WHERE t.sprint_id = ?
      AND t.status IN ('in_progress', 'in_review')
    GROUP BY t.id
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
      t.sort_order ASC,
      t.created_at DESC
  `).all(sprint.id).map((ticket) => ({
    ...ticket,
    assignee_names: ticket.assignee_names ? ticket.assignee_names.split(',') : [],
  }));

  return NextResponse.json({ sprint, sprints, members, in_progress_tickets: inProgressTickets });
}
