import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { notifyDueReminder } from '@/lib/discord';
import { classifyDue, markDueReminderSent } from '@/lib/reminders';
import { getTicketById } from '../../tickets/route';

// Called by a scheduled job (e.g. a daily system cron). Authenticated with a
// shared secret rather than a user session.
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // Open tickets with a due date and an assignee who has a Discord ID.
  const rows = db.prepare(`
    SELECT t.id, u.discord_id
    FROM tickets t
    JOIN users u ON u.id = t.assignee_id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND u.discord_id IS NOT NULL
  `).all();

  let sent = 0;
  for (const row of rows) {
    const ticket = getTicketById(db, row.id);
    const kind = classifyDue(ticket);
    if (!kind) continue;
    if (!markDueReminderSent(db, ticket, kind)) continue;

    notifyDueReminder(ticket, { kind, assigneeDiscordId: row.discord_id });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent });
}
