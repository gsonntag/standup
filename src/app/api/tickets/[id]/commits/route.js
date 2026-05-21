import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { publish } from '@/lib/events';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

function serializeCommit(row) {
  let branches = [];
  try {
    branches = JSON.parse(row.branches_json || '[]');
  } catch (_) {}
  return {
    sha: row.sha,
    short_sha: row.sha.slice(0, 7),
    message: row.message,
    author_name: row.author_name,
    author_login: row.author_login,
    committed_at: row.committed_at,
    html_url: row.html_url,
    branches,
    linked_at: row.linked_at,
    linked_by_username: row.linked_by_username,
  };
}

function getTicket(db, id) {
  return db.prepare('SELECT id, github_repo_id FROM tickets WHERE id = ?').get(id);
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);

  const commits = db.prepare(`
    SELECT gc.*, tc.linked_at, u.username AS linked_by_username
    FROM ticket_commits tc
    JOIN github_commits gc ON gc.repo_id = tc.repo_id AND gc.sha = tc.sha
    JOIN users u ON u.id = tc.linked_by
    WHERE tc.ticket_id = ?
    ORDER BY gc.committed_at DESC, gc.sha ASC
  `).all(ticketId).map(serializeCommit);

  return NextResponse.json({ commits });
});

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);
  if (!ticket.github_repo_id) return jsonError('Select a GitHub repository before linking commits.');

  const body = await request.json();
  const shas = Array.isArray(body.shas) ? body.shas : [body.sha];
  const normalizedShas = [...new Set(shas.map((sha) => String(sha || '').trim()).filter(Boolean))];
  if (!normalizedShas.length) return jsonError('At least one commit SHA is required.');

  const missing = normalizedShas.find((sha) => !db.prepare(`
    SELECT sha FROM github_commits WHERE repo_id = ? AND sha = ?
  `).get(ticket.github_repo_id, sha));
  if (missing) return jsonError('Commit not found for this ticket repository.', 404);

  const tx = db.transaction(() => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO ticket_commits (ticket_id, repo_id, sha, linked_by)
      VALUES (?, ?, ?, ?)
    `);
    for (const sha of normalizedShas) {
      insert.run(ticketId, ticket.github_repo_id, sha, user.id);
    }
  });
  tx();

  publish({ kind: 'ticket', id: ticketId, action: 'updated' });
  return NextResponse.json({ commits: db.prepare(`
    SELECT gc.*, tc.linked_at, u.username AS linked_by_username
    FROM ticket_commits tc
    JOIN github_commits gc ON gc.repo_id = tc.repo_id AND gc.sha = tc.sha
    JOIN users u ON u.id = tc.linked_by
    WHERE tc.ticket_id = ?
    ORDER BY gc.committed_at DESC, gc.sha ASC
  `).all(ticketId).map(serializeCommit) });
});

export const DELETE = withAuth(async (request, _user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const ticket = getTicket(db, ticketId);
  if (!ticket) return jsonError('Ticket not found.', 404);

  const body = await request.json();
  const sha = String(body.sha || '').trim();
  if (!sha) return jsonError('Commit SHA is required.');

  db.prepare('DELETE FROM ticket_commits WHERE ticket_id = ? AND sha = ?').run(ticketId, sha);
  publish({ kind: 'ticket', id: ticketId, action: 'updated' });
  return NextResponse.json({ ok: true });
});

