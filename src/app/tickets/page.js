import { Suspense } from 'react';
import { requireCurrentUser } from '@/lib/require-user';
import AstryxTicketsTable from '@/components/AstryxTicketsTable';

export default async function TicketsPage() {
  const user = await requireCurrentUser();
  return (
    <Suspense>
      <AstryxTicketsTable currentUser={user} />
    </Suspense>
  );
}
