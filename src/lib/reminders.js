import { daysUntil } from './dates';

export function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns 'overdue' | 'today' | 'soon' | null for an open ticket with a due date.
export function classifyDue(ticket) {
  if (!ticket?.due_date || ticket.status === 'done') return null;
  const days = daysUntil(ticket.due_date);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'soon';
  return null;
}

// De-dup key: 'today'/'soon' fire once per due date; 'overdue' once per day.
function dueReminderKey(ticket, kind) {
  const refDate = kind === 'overdue' ? localToday() : ticket.due_date;
  return `${ticket.id}:${kind}:${refDate}`;
}

// Records that a due reminder was sent. Returns true if it was newly recorded
// (caller should send it), false if it had already been sent this cycle.
export function markDueReminderSent(db, ticket, kind) {
  const key = dueReminderKey(ticket, kind);
  return db.prepare('INSERT OR IGNORE INTO reminder_log (key) VALUES (?)').run(key).changes > 0;
}
