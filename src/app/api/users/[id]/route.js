import { NextResponse } from 'next/server';
import { jsonError, withAdmin } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { getDb } from '@/lib/db';

const ROLE_VALUES = new Set(Object.values(ROLES));

async function getId(context) {
  const params = await context.params;
  return params.id;
}

export const PATCH = withAdmin(async (request, currentUser, context) => {
  const db = getDb();
  const id = await getId(context);
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
  if (!user) return jsonError('User not found.', 404);
  if (user.id === currentUser.id) return jsonError('You cannot change your own role.', 400);

  const { role } = await request.json();
  if (!ROLE_VALUES.has(role)) return jsonError('Invalid role.');

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  return NextResponse.json({
    user: db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id),
  });
});

export const DELETE = withAdmin(async (_request, currentUser, context) => {
  const db = getDb();
  const id = await getId(context);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return jsonError('User not found.', 404);
  if (user.id === currentUser.id) return jsonError('You cannot delete your own user.', 400);

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE author_id = ?').run(id);
    db.prepare('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ?').run(id);
    db.prepare('UPDATE tickets SET creator_id = ? WHERE creator_id = ?').run(currentUser.id, id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  tx();

  return NextResponse.json({ ok: true });
});
