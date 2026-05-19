import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_DURATION_DAYS } from './constants';
import { getDb } from './db';

const COOKIE_NAME = 'session';

export function authenticate(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password)) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function createSession(userId) {
  const db = getDb();
  const id = uuidv4();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(id, userId, expiresAt);
  return id;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  const newExpiry = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, sessionId);

  return db.prepare(
    'SELECT id, username, role, created_at FROM users WHERE id = ?'
  ).get(session.user_id) || null;
}

export function destroySession(sessionId) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export { COOKIE_NAME };
