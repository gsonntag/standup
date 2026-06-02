import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { attachAssignees, attachLabels } from '../../tickets/route';

export const GET = withAuth(async (_request, user) => {
  const db = getDb();

  // 1. Assigned to me (open tickets)
  const assignedRaw = db.prepare(`
    SELECT t.*, assignee.username AS assignee_username, creator.username AS creator_username,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (SELECT COUNT(*) FROM ticket_dependencies td JOIN tickets dep ON dep.id = td.depends_on_id WHERE td.ticket_id = t.id AND dep.status != 'done') AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    JOIN users creator ON creator.id = t.creator_id
    WHERE (t.assignee_id = ? OR t.id IN (SELECT ticket_id FROM ticket_assignees WHERE user_id = ?)) AND t.status != 'done'
    ORDER BY t.due_date ASC NULLS LAST, t.priority ASC, t.created_at DESC
  `).all(user.id, user.id);
  const assigned = attachLabels(db, attachAssignees(db, assignedRaw));

  // 2. Mentions (unacknowledged)
  const mentions = db.prepare(`
    SELECT m.id AS mention_id, m.ticket_id, m.comment_id, m.created_at,
           t.title AS ticket_title, t.number AS ticket_number
    FROM mentions m
    JOIN tickets t ON t.id = m.ticket_id
    WHERE m.user_id = ? AND m.acknowledged = 0
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all(user.id);

  // 3. Watching (tickets I watch with activity in the last 7 days)
  const watchingRaw = db.prepare(`
    SELECT t.*, assignee.username AS assignee_username, creator.username AS creator_username,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (SELECT COUNT(*) FROM ticket_dependencies td JOIN tickets dep ON dep.id = td.depends_on_id WHERE td.ticket_id = t.id AND dep.status != 'done') AS unresolved_blocker_count
    FROM ticket_watchers tw
    JOIN tickets t ON t.id = tw.ticket_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    JOIN users creator ON creator.id = t.creator_id
    WHERE tw.user_id = ? AND t.updated_at >= datetime('now', '-7 days')
    AND t.id NOT IN (SELECT ticket_id FROM ticket_assignees WHERE user_id = ?)
    ORDER BY t.updated_at DESC
    LIMIT 10
  `).all(user.id, user.id);
  const watching = attachLabels(db, attachAssignees(db, watchingRaw));

  // 4. Blockers cleared (tickets I'm assigned to whose blockers all moved to done in last 7 days)
  const blockersCleared = db.prepare(`
    SELECT DISTINCT t.id, t.number, t.title, t.status
    FROM tickets t
    JOIN ticket_dependencies td ON td.ticket_id = t.id
    JOIN tickets dep ON dep.id = td.depends_on_id
    WHERE (t.assignee_id = ? OR t.id IN (SELECT ticket_id FROM ticket_assignees WHERE user_id = ?))
      AND t.status IN ('backlog', 'todo', 'in_progress')
      AND dep.status = 'done'
      AND dep.updated_at >= datetime('now', '-7 days')
      AND NOT EXISTS (
        SELECT 1 FROM ticket_dependencies td2
        JOIN tickets dep2 ON dep2.id = td2.depends_on_id
        WHERE td2.ticket_id = t.id AND dep2.status != 'done'
      )
  `).all(user.id, user.id);

  return NextResponse.json({ assigned, mentions, watching, blockers_cleared: blockersCleared });
});
