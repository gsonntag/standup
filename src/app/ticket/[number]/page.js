import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/require-user';
import { getDb } from '@/lib/db';
import BacklogView from '@/components/BacklogView';

// Clean, shareable deep link by ticket number (e.g. from Discord). Resolves the
// number to the ticket's id, then opens it in the backlog view.
export default async function TicketByNumberPage({ params }) {
  const user = await requireCurrentUser();
  const { number } = await params;
  const parsed = parseInt(number, 10);
  const ticket = Number.isInteger(parsed)
    ? getDb().prepare('SELECT id FROM tickets WHERE number = ?').get(parsed)
    : null;
  if (!ticket) notFound();

  return (
    <Suspense>
      <BacklogView currentUser={user} initialTicketId={ticket.id} />
    </Suspense>
  );
}
