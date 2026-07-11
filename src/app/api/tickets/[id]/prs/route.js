import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { publish } from '@/lib/events';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

function getTicket(db, id) {
  return db.prepare('SELECT id, status, github_repo_id FROM tickets WHERE id = ?').get(id);
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);

  const prs = db.prepare(`
    SELECT gpr.*, tpr.linked_at, u.username AS linked_by_username, gr.owner AS repo_owner, gr.name AS repo_name
    FROM ticket_pull_requests tpr
    JOIN github_pull_requests gpr ON gpr.repo_id = tpr.repo_id AND gpr.number = tpr.pr_number
    JOIN github_repositories gr ON gr.id = tpr.repo_id
    JOIN users u ON u.id = tpr.linked_by
    WHERE tpr.ticket_id = ?
    ORDER BY gpr.created_at DESC, gpr.number DESC
  `).all(ticketId);

  return NextResponse.json({ prs });
});

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);

  const body = await request.json();
  const repoId = body.repo_id || ticket.github_repo_id;
  if (!repoId) {
    return jsonError('Select a GitHub repository before linking pull requests.');
  }

  const isLinked = db.prepare('SELECT 1 FROM ticket_repositories WHERE ticket_id = ? AND repo_id = ?').get(ticketId, repoId);
  if (!isLinked) return jsonError('Repository is not linked to this ticket.', 400);

  const prNumber = parseInt(body.pr_number, 10);
  if (isNaN(prNumber)) return jsonError('A valid pull request number is required.');

  const prExists = db.prepare(`
    SELECT number FROM github_pull_requests WHERE repo_id = ? AND number = ?
  `).get(repoId, prNumber);
  if (!prExists) {
    return jsonError('Pull request not found for this ticket repository.', 404);
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO ticket_pull_requests (ticket_id, repo_id, pr_number, linked_by)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, repoId, prNumber, user.id);

    // Automatically transition ticket to 'in_review' if it's not already in_review or done
    if (ticket.status !== 'in_review' && ticket.status !== 'done') {
      db.prepare(`
        UPDATE tickets
        SET status = 'in_review', updated_at = datetime('now')
        WHERE id = ?
      `).run(ticketId);

      db.prepare(`
        INSERT INTO ticket_events (id, ticket_id, actor_id, kind, field, old_value, new_value, created_at)
        VALUES (?, ?, ?, 'field_change', 'status', ?, 'in_review', datetime('now'))
      `).run(uuidv4(), ticketId, user.id, ticket.status);
    }
  });
  tx();

  publish({ kind: 'ticket', id: ticketId, action: 'updated' });

  const updatedPrs = db.prepare(`
    SELECT gpr.*, tpr.linked_at, u.username AS linked_by_username, gr.owner AS repo_owner, gr.name AS repo_name
    FROM ticket_pull_requests tpr
    JOIN github_pull_requests gpr ON gpr.repo_id = tpr.repo_id AND gpr.number = tpr.pr_number
    JOIN github_repositories gr ON gr.id = tpr.repo_id
    JOIN users u ON u.id = tpr.linked_by
    WHERE tpr.ticket_id = ?
    ORDER BY gpr.created_at DESC, gpr.number DESC
  `).all(ticketId);

  return NextResponse.json({ prs: updatedPrs });
});

export const DELETE = withAuth(async (request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);

  const body = await request.json();
  const prNumber = parseInt(body.pr_number, 10);
  if (isNaN(prNumber)) return jsonError('Pull request number is required.');

  const repoId = body.repo_id || ticket.github_repo_id;
  if (repoId) {
    db.prepare(`
      DELETE FROM ticket_pull_requests WHERE ticket_id = ? AND repo_id = ? AND pr_number = ?
    `).run(ticketId, repoId, prNumber);
  } else {
    db.prepare(`
      DELETE FROM ticket_pull_requests WHERE ticket_id = ? AND pr_number = ?
    `).run(ticketId, prNumber);
  }

  publish({ kind: 'ticket', id: ticketId, action: 'updated' });
  return NextResponse.json({ ok: true });
});
