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
  const isNumeric = typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id));
  return db.prepare(`
    SELECT id, number, title, status, github_repo_id
    FROM tickets
    WHERE id = ? OR (number = ? AND ?)
  `).get(id, isNumeric ? parseInt(id, 10) : -1, isNumeric ? 1 : 0);
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const rawId = await getId(context);
  const ticket = getTicket(db, rawId);
  if (!ticket) return jsonError('Ticket not found.', 404);
  const ticketId = ticket.id;

  // 1. Linked PRs
  const prs = db.prepare(`
    SELECT gpr.*, tpr.linked_at, u.username AS linked_by_username, gr.owner AS repo_owner, gr.name AS repo_name
    FROM ticket_pull_requests tpr
    JOIN github_pull_requests gpr ON gpr.repo_id = tpr.repo_id AND gpr.number = tpr.pr_number
    JOIN github_repositories gr ON gr.id = tpr.repo_id
    JOIN users u ON u.id = tpr.linked_by
    WHERE tpr.ticket_id = ?
    ORDER BY gpr.created_at DESC, gpr.number DESC
  `).all(ticketId);

  const linkedKeys = new Set(prs.map((p) => `${p.repo_id}:${p.number}`));

  // 2. Auto-detected recent PRs matching ticket number or title
  const numberToken = `#${ticket.number}`;
  const numberStr = String(ticket.number);
  const detectedCandidateRows = db.prepare(`
    SELECT gpr.*, gr.owner AS repo_owner, gr.name AS repo_name
    FROM github_pull_requests gpr
    JOIN github_repositories gr ON gr.id = gpr.repo_id
    WHERE (
      gpr.title LIKE ?
      OR gpr.title LIKE ?
      OR gpr.title LIKE ?
    )
    ORDER BY gpr.created_at DESC
    LIMIT 20
  `).all(`%${numberToken}%`, `%fix/${numberStr}%`, `%feat/${numberStr}%`);

  const detected_prs = detectedCandidateRows.filter(
    (p) => !linkedKeys.has(`${p.repo_id}:${p.number}`)
  );

  // 3. Recent PRs across connected repositories (not yet linked)
  const recentCandidateRows = db.prepare(`
    SELECT gpr.*, gr.owner AS repo_owner, gr.name AS repo_name
    FROM github_pull_requests gpr
    JOIN github_repositories gr ON gr.id = gpr.repo_id
    ORDER BY gpr.created_at DESC
    LIMIT 25
  `).all();

  const recent_prs = recentCandidateRows.filter(
    (p) => !linkedKeys.has(`${p.repo_id}:${p.number}`) && !detected_prs.some((dp) => dp.repo_id === p.repo_id && dp.number === p.number)
  );

  return NextResponse.json({
    prs,
    detected_prs,
    recent_prs,
  });
});

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const rawId = await getId(context);
  const ticket = getTicket(db, rawId);
  if (!ticket) return jsonError('Ticket not found.', 404);
  const ticketId = ticket.id;

  const body = await request.json();
  let repoId = body.repo_id || ticket.github_repo_id;
  if (!repoId) {
    const firstRepo = db.prepare('SELECT id FROM github_repositories ORDER BY owner ASC, name ASC LIMIT 1').get();
    if (firstRepo) repoId = firstRepo.id;
  }
  if (!repoId) {
    return jsonError('Please connect or select a GitHub repository first.');
  }

  const prNumber = parseInt(body.pr_number, 10);
  if (isNaN(prNumber) || prNumber < 1) {
    return jsonError('A valid positive pull request number is required.');
  }

  // Ensure repository is associated with ticket
  db.prepare(`
    INSERT OR IGNORE INTO ticket_repositories (ticket_id, repo_id)
    VALUES (?, ?)
  `).run(ticketId, repoId);

  // If primary repository on ticket is null, set it
  if (!ticket.github_repo_id) {
    db.prepare('UPDATE tickets SET github_repo_id = ? WHERE id = ?').run(repoId, ticketId);
  }

  // If PR is not in github_pull_requests, create a stub so linking works seamlessly
  const prExists = db.prepare(`
    SELECT number FROM github_pull_requests WHERE repo_id = ? AND number = ?
  `).get(repoId, prNumber);

  if (!prExists) {
    const repo = db.prepare('SELECT owner, name, html_url FROM github_repositories WHERE id = ?').get(repoId);
    const prTitle = body.title?.trim() || `Pull Request #${prNumber}`;
    const prUrl = body.html_url?.trim() || (repo?.html_url ? `${repo.html_url}/pull/${prNumber}` : `https://github.com/pull/${prNumber}`);
    db.prepare(`
      INSERT INTO github_pull_requests (repo_id, number, title, state, html_url, author_login, created_at, updated_at)
      VALUES (?, ?, ?, 'open', ?, ?, datetime('now'), datetime('now'))
    `).run(repoId, prNumber, prTitle, prUrl, user.username || 'github');
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO ticket_pull_requests (ticket_id, repo_id, pr_number, linked_by)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, repoId, prNumber, user.id);

    // Transition ticket to 'in_review' if it's currently 'todo' or 'in_progress'
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

  return NextResponse.json({ prs: updatedPrs, ok: true });
});

export const DELETE = withAuth(async (request, _user, context) => {
  const db = getDb();
  const rawId = await getId(context);
  const ticket = getTicket(db, rawId);
  if (!ticket) return jsonError('Ticket not found.', 404);
  const ticketId = ticket.id;

  let repoId = null;
  let prNumber = null;

  try {
    const body = await request.json();
    prNumber = parseInt(body.pr_number, 10);
    repoId = body.repo_id;
  } catch {
    // Check searchParams if body is empty
  }

  if (isNaN(prNumber) || !prNumber) {
    const { searchParams } = new URL(request.url);
    prNumber = parseInt(searchParams.get('pr_number'), 10);
    if (!repoId) repoId = searchParams.get('repo_id');
  }

  if (isNaN(prNumber) || !prNumber) return jsonError('Pull request number is required.');

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
