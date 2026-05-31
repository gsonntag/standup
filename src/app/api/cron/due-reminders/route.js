import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { daysUntil } from '@/lib/dates';
import { notifyDueReminder } from '@/lib/discord';
import { getTicketById } from '../../tickets/route';

// Called by a scheduled job (e.g. a daily system cron). Authenticated with a
// shared secret rather than a user session.
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const today = localToday();

  // Open tickets with a due date and an assignee who has a Discord ID.
  const tickets = db.prepare(`
    SELECT t.id, t.due_date, u.discord_id
    FROM tickets t
    JOIN users u ON u.id = t.assignee_id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND u.discord_id IS NOT NULL
  `).all();

  let sent = 0;
  for (const row of tickets) {
    const days = daysUntil(row.due_date);
    let kind = null;
    if (days < 0) kind = 'overdue';
    else if (days === 0) kind = 'today';
    else if (days === 1) kind = 'soon';
    if (!kind) continue;

    // Dedup: 'today'/'soon' fire once per due date; 'overdue' fires once per day.
    const refDate = kind === 'overdue' ? today : row.due_date;
    const key = `${row.id}:${kind}:${refDate}`;
    const inserted = db.prepare('INSERT OR IGNORE INTO reminder_log (key) VALUES (?)').run(key);
    if (inserted.changes === 0) continue;

    notifyDueReminder(getTicketById(db, row.id), { kind, assigneeDiscordId: row.discord_id });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: tickets.length, sent });
}
