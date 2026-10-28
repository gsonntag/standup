import { getDb } from '@/lib/db';
import { requireCurrentUser } from '@/lib/require-user';
import AstryxBoard from '@/components/AstryxBoard';

export default async function OverviewPage() {
  const user = await requireCurrentUser();
  const activeSprint = getDb().prepare(
    "SELECT * FROM sprints WHERE status = 'active' LIMIT 1"
  ).get();

  return <AstryxBoard sprintId={activeSprint?.id || null} currentUser={user} />;
}
