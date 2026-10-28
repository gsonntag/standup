import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/require-user';
import { getDb } from '@/lib/db';
import AstryxTicketPage from '@/components/AstryxTicketPage';

export default async function TicketByNumberPage({ params }) {
  const user = await requireCurrentUser();
  const { number } = await params;
  const parsed = parseInt(number, 10);
  if (!Number.isInteger(parsed)) notFound();

  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, s.name AS sprint_name, u.username AS creator_username, a.username AS assignee_username
    FROM tickets t
    LEFT JOIN sprints s ON s.id = t.sprint_id
    LEFT JOIN users u ON u.id = t.creator_id
    LEFT JOIN users a ON a.id = t.assignee_id
    WHERE t.number = ?
  `).get(parsed);

  if (!ticket) notFound();

  return (
    <Suspense>
      <AstryxTicketPage ticketId={ticket.id} initialTicket={ticket} currentUser={user} />
    </Suspense>
  );
}
