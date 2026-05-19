import { requireCurrentUser } from '@/lib/require-user';
import SprintView from '@/components/SprintView';

export default async function SprintsPage() {
  const user = await requireCurrentUser();
  return <SprintView currentUser={user} />;
}
