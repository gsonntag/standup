import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { getDb } from '@/lib/db';

export const POST = withAuth(async (request, currentUser) => {
  const db = getDb();
  const { current_password, new_password } = await request.json();

  if (!new_password) {
    return jsonError('New password is required.');
  }
  if (new_password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const user = db.prepare('SELECT password, must_change_password FROM users WHERE id = ?').get(currentUser.id);
  if (!user) return jsonError('User not found.', 404);

  // On a forced first-login change, the current password is not required.
  if (!user.must_change_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password)) {
      return jsonError('Current password is incorrect.', 401);
    }
  }

  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 10), currentUser.id);

  return NextResponse.json({ ok: true });
});
