import { Suspense } from 'react';
import { requireCurrentUser } from '@/lib/require-user';
import BacklogView from '@/components/BacklogView';

export default async function BacklogPage() {
  const user = await requireCurrentUser();
  return (
    <Suspense>
      <BacklogView currentUser={user} />
    </Suspense>
  );
}
