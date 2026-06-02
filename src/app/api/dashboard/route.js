import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async (request) => {
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
    return NextResponse.json({
      sprint: null,
      sprints,
      members: [],
      in_progress_tickets: [],
      due_soon_tickets: [],
      blocked_tickets: [],
      unassigned_tickets: [],
      summary: null,
      burnup_chart: [],
      recent_activity: [],
    });
  }

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_tickets,
      COALESCE(SUM(CASE WHEN status = 'backlog' THEN 1 ELSE 0 END), 0) AS backlog,
      COALESCE(SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END), 0) AS todo,
      COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
      COALESCE(SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END), 0) AS in_review,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done,
      COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND status != 'done' AND date(due_date) < date('now') THEN 1 ELSE 0 END), 0) AS overdue,
      COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND status != 'done' AND date(due_date) BETWEEN date('now') AND date('now', '+7 days') THEN 1 ELSE 0 END), 0) AS due_soon,
      COALESCE(SUM(CASE WHEN assignee_id IS NULL AND id NOT IN (SELECT ticket_id FROM ticket_assignees) THEN 1 ELSE 0 END), 0) AS unassigned,
      COALESCE(SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END), 0) AS priority_low,
      COALESCE(SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END), 0) AS priority_medium,
      COALESCE(SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END), 0) AS priority_high,
      COALESCE(SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END), 0) AS priority_urgent
    FROM tickets
    WHERE sprint_id = ?
  `).get(sprint.id);

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
    SELECT t.id, t.number, t.title, t.status, t.priority, t.due_date, t.total_points, t.points_remaining,
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

  const blockedTickets = db.prepare(`
    SELECT t.id, t.number, t.title, t.status, t.priority, t.due_date,
      GROUP_CONCAT(DISTINCT u.username) AS assignee_names,
      (
        SELECT COUNT(*)
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      ) AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN ticket_assignees ta ON ta.ticket_id = t.id
    LEFT JOIN users u ON u.id = ta.user_id
    WHERE t.sprint_id = ?
      AND t.status != 'done'
      AND EXISTS (
        SELECT 1
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      )
    GROUP BY t.id
    ORDER BY unresolved_blocker_count DESC, t.sort_order ASC
    LIMIT 8
  `).all(sprint.id).map((ticket) => ({
    ...ticket,
    assignee_names: ticket.assignee_names ? ticket.assignee_names.split(',') : [],
  }));

  const dueSoonTickets = db.prepare(`
    SELECT t.id, t.number, t.title, t.status, t.priority, t.due_date,
      GROUP_CONCAT(DISTINCT u.username) AS assignee_names
    FROM tickets t
    LEFT JOIN ticket_assignees ta ON ta.ticket_id = t.id
    LEFT JOIN users u ON u.id = ta.user_id
    WHERE t.sprint_id = ?
      AND t.status != 'done'
      AND t.due_date IS NOT NULL
      AND date(t.due_date) <= date('now', '+7 days')
    GROUP BY t.id
    ORDER BY date(t.due_date) ASC, t.sort_order ASC
    LIMIT 8
  `).all(sprint.id).map((ticket) => ({
    ...ticket,
    assignee_names: ticket.assignee_names ? ticket.assignee_names.split(',') : [],
  }));

  const unassignedTickets = db.prepare(`
    SELECT t.id, t.number, t.title, t.status, t.priority, t.due_date
    FROM tickets t
    WHERE t.sprint_id = ?
      AND t.status != 'done'
      AND t.assignee_id IS NULL
      AND t.id NOT IN (SELECT ticket_id FROM ticket_assignees)
    ORDER BY t.sort_order ASC, t.created_at DESC
    LIMIT 8
  `).all(sprint.id);

  // Generate burnup chart data points
  const burnupData = [];
  const startDate = new Date(sprint.start_date);
  const endDate = new Date(sprint.end_date);
  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    const dates = [];
    const current = new Date(startDate);
    let count = 0;
    while (current <= endDate && count < 90) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
      count++;
    }

    const ticketsForBurnup = db.prepare(`
      SELECT t.id, t.status, COALESCE(t.total_points, 0) AS total_points, t.created_at, t.updated_at,
        (
          SELECT created_at FROM ticket_events
          WHERE ticket_id = t.id AND field = 'status' AND new_value = 'done'
          ORDER BY created_at DESC LIMIT 1
        ) AS completion_event_time
      FROM tickets t
      WHERE t.sprint_id = ?
    `).all(sprint.id);

    const completedDateMap = {};
    ticketsForBurnup.forEach((t) => {
      if (t.status === 'done') {
        if (t.completion_event_time) {
          completedDateMap[t.id] = t.completion_event_time.slice(0, 10);
        } else {
          completedDateMap[t.id] = (t.updated_at || t.created_at || '').slice(0, 10);
        }
      }
    });

    const totalScope = ticketsForBurnup.reduce((acc, t) => acc + t.total_points, 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    dates.forEach((dayStr, dayIndex) => {
      const ideal = dates.length > 1 ? Math.round((dayIndex / (dates.length - 1)) * totalScope * 10) / 10 : totalScope;
      const isFuture = dayStr > todayStr;
      let actual = 0;
      if (!isFuture) {
        actual = ticketsForBurnup
          .filter((t) => t.status === 'done' && completedDateMap[t.id] && completedDateMap[t.id] <= dayStr)
          .reduce((acc, t) => acc + t.total_points, 0);
      }

      burnupData.push({
        date: dayStr,
        ideal,
        actual: isFuture ? null : actual,
        scope: totalScope,
      });
    });
  }

  // Get recent activity
  const activityEvents = db.prepare(`
    SELECT te.id, te.ticket_id, te.actor_id, te.kind, te.field, te.old_value, te.new_value, te.created_at,
      u.username AS actor_username, t.number AS ticket_number, t.title AS ticket_title
    FROM ticket_events te
    JOIN tickets t ON t.id = te.ticket_id
    JOIN users u ON u.id = te.actor_id
    WHERE t.sprint_id = ?
    ORDER BY te.created_at DESC
    LIMIT 20
  `).all(sprint.id);

  const comments = db.prepare(`
    SELECT c.id, c.ticket_id, c.author_id AS actor_id, 'comment' AS kind, 'comment' AS field, NULL AS old_value, c.content AS new_value, c.created_at,
      u.username AS actor_username, t.number AS ticket_number, t.title AS ticket_title
    FROM comments c
    JOIN tickets t ON t.id = c.ticket_id
    JOIN users u ON u.id = c.author_id
    WHERE t.sprint_id = ? AND c.kind = 'user' AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 20
  `).all(sprint.id);

  const recentActivity = [...activityEvents, ...comments]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 15);

  return NextResponse.json({
    sprint,
    sprints,
    members,
    in_progress_tickets: inProgressTickets,
    blocked_tickets: blockedTickets,
    due_soon_tickets: dueSoonTickets,
    unassigned_tickets: unassignedTickets,
    summary,
    burnup_chart: burnupData,
    recent_activity: recentActivity,
  });
});
