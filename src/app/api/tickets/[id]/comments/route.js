import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { publish } from '@/lib/events';
import { getTicketById } from '../../route';
import { notifyComment, ticketStakeholderDiscordIds } from '@/lib/discord';

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const GET = withAuth(async (_request, user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  const comments = db.prepare(`
    SELECT c.*, u.username AS author_username,
           c.kind, c.deleted_at,
           del.username AS deleted_by_username
    FROM comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN users del ON del.id = c.deleted_by
    WHERE c.ticket_id = ?
    ORDER BY c.created_at ASC
  `).all(ticketId);

  for (const comment of comments) {
    if (comment.deleted_at && user.role !== 'admin') {
      comment.content = '[deleted]';
    }
  }

  return NextResponse.json({ comments });
});

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const ticketId = await getId(context);
  if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId)) {
    return jsonError('Ticket not found.', 404);
  }
  const { content } = await request.json();
  if (!content?.trim()) return jsonError('Content is required.');

  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, content, ticket_id, author_id, kind) VALUES (?, ?, ?, ?, \'user\')')
    .run(id, content.trim(), ticketId, user.id);
  // Auto-add commenter as watcher
  db.prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)').run(ticketId, user.id);
  // Parse @mentions and insert rows
  const mentionPattern = /@(\w{1,32})/g;
  let match;
  const mentionedUserIds = new Set();
  while ((match = mentionPattern.exec(content)) !== null) {
    const username = match[1];
    const mentioned = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (mentioned && mentioned.id !== user.id) {
      mentionedUserIds.add(mentioned.id);
    }
  }
  for (const mentionedId of mentionedUserIds) {
    db.prepare('INSERT INTO mentions (id, comment_id, ticket_id, user_id) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), id, ticketId, mentionedId);
  }
  const comment = db.prepare(`
    SELECT c.*, u.username AS author_username,
           c.kind, c.deleted_at,
           del.username AS deleted_by_username
    FROM comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN users del ON del.id = c.deleted_by
    WHERE c.id = ?
  `).get(id);
  publish({ kind: 'comment', ticket_id: ticketId });

  const pings = ticketStakeholderDiscordIds(ticketId, { excludeUserId: user.id, mentionsForCommentId: id });
  if (pings.length) {
    notifyComment(getTicketById(db, ticketId), { actorName: user.username, body: content.trim(), pingDiscordIds: pings });
  }

  return NextResponse.json({ comment }, { status: 201 });
});
