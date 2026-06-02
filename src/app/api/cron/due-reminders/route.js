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
    JOIN ticket_assignees ta ON ta.ticket_id = t.id
    JOIN users u ON u.id = ta.user_id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND u.discord_id IS NOT NULL
  `).all();

  const discordIdsByTicket = new Map();
  for (const row of rows) {
    if (!discordIdsByTicket.has(row.id)) discordIdsByTicket.set(row.id, []);
    discordIdsByTicket.get(row.id).push(row.discord_id);
  }

  let sent = 0;
  for (const [ticketId, discordIds] of discordIdsByTicket) {
    const ticket = getTicketById(db, ticketId);
    const kind = classifyDue(ticket);
    if (!kind) continue;
    if (!markDueReminderSent(db, ticket, kind)) continue;

    notifyDueReminder(ticket, { kind, assigneeDiscordId: discordIds });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: discordIdsByTicket.size, sent });
}
