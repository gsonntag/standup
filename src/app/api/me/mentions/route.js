import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

export const GET = withAuth(async (_request, user) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM mentions WHERE user_id = ? AND acknowledged = 0').get(user.id).c;
  return NextResponse.json({ unread_count: count });
});
