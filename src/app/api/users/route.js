import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAdmin, withAuth } from '@/lib/api';
import { MAX_USERNAME_LENGTH } from '@/lib/constants';
import { getDb } from '@/lib/db';

export const GET = withAuth(async () => {
  const users = getDb().prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY username ASC'
  ).all();
  return NextResponse.json({ users });
});

export const POST = withAdmin(async (request) => {
  const db = getDb();
  const { username, password } = await request.json();

  if (!username) return jsonError('Username is required.');
  if (username !== username.toLowerCase()) return jsonError('Username must be lowercase.');
  if (username.length > MAX_USERNAME_LENGTH) return jsonError(`Username must be ${MAX_USERNAME_LENGTH} chars or fewer.`);
  if (!/^[a-z][a-z0-9]*$/.test(username)) {
    return jsonError('Username must start with a letter, letters and numbers only.');
  }
  if (!password || password.length < 4) return jsonError('Password must be at least 4 characters.');
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return jsonError('Username already exists.');

  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)')
    .run(id, username, bcrypt.hashSync(password, 10), 'member');
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
  return NextResponse.json({ user }, { status: 201 });
});
