import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { getDb } from '@/lib/db';

export const POST = withAuth(async (request, currentUser) => {
  const db = getDb();
  const { current_password, new_password } = await request.json();

  if (!current_password || !new_password) {
    return jsonError('Current and new password are required.');
  }
  if (new_password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(currentUser.id);
  if (!user || !bcrypt.compareSync(current_password, user.password)) {
    return jsonError('Current password is incorrect.', 401);
  }

  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 10), currentUser.id);

  return NextResponse.json({ ok: true });
});
