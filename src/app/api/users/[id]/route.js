import { NextResponse } from 'next/server';
import { jsonError, withAdmin, withAuth } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { getDb } from '@/lib/db';

const ROLE_VALUES = new Set(Object.values(ROLES));

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const PATCH = withAuth(async (request, currentUser, context) => {
  const db = getDb();
  const id = await getId(context);
  const user = db.prepare('SELECT id, username, role, discord_id, created_at FROM users WHERE id = ?').get(id);
  if (!user) return jsonError('User not found.', 404);

  const isAdmin = currentUser.role === 'admin';
  const isSelf = currentUser.id === id;

  if (!isAdmin && !isSelf) return jsonError('Forbidden.', 403);

  const body = await request.json();
  const sets = [];
  const args = [];

  if ('role' in body) {
    if (!isAdmin) return jsonError('Only admins can change roles.', 403);
    if (isSelf) return jsonError('You cannot change your own role.', 400);
    if (!ROLE_VALUES.has(body.role)) return jsonError('Invalid role.');
    sets.push('role = ?');
    args.push(body.role);
  }

  if ('discord_id' in body) {
    const val = body.discord_id?.trim() || null;
    sets.push('discord_id = ?');
    args.push(val);
  }

  if (!sets.length) return jsonError('Nothing to update.');

  args.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);

  return NextResponse.json({
    user: db.prepare('SELECT id, username, role, discord_id, created_at FROM users WHERE id = ?').get(id),
  });
});

export const DELETE = withAdmin(async (_request, currentUser, context) => {
  const db = getDb();
  const id = await getId(context);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return jsonError('User not found.', 404);
  if (user.id === currentUser.id) return jsonError('You cannot delete your own account.', 400);

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM ticket_events WHERE actor_id = ?').run(id);
    db.prepare('UPDATE ticket_attachments SET uploader_id = ? WHERE uploader_id = ?').run(currentUser.id, id);
    db.prepare('UPDATE retro_notes SET author_id = ? WHERE author_id = ?').run(currentUser.id, id);
    db.prepare('DELETE FROM comments WHERE author_id = ?').run(id);
    db.prepare('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ?').run(id);
    db.prepare('UPDATE tickets SET creator_id = ? WHERE creator_id = ?').run(currentUser.id, id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  tx();

  return NextResponse.json({ ok: true });
});
