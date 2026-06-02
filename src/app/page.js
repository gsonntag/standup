import { getDb } from '@/lib/db';
import { requireCurrentUser } from '@/lib/require-user';
import Board from '@/components/Board';
import AppPageHeader from '@/components/AppPageHeader';

export default async function OverviewPage() {
  const user = await requireCurrentUser();
  const activeSprint = getDb().prepare(
    "SELECT * FROM sprints WHERE status = 'active' LIMIT 1"
  ).get();

  return (
    <div className="page page-board">
      <AppPageHeader
        eyebrow="Overview"
        title={activeSprint ? activeSprint.name : 'Overview'}
        subtitle={activeSprint ? 'Track sprint work across status lanes.' : 'Start a sprint to activate the team overview.'}
        meta={activeSprint && (
          <span className="linear-date-pill">{activeSprint.start_date} - {activeSprint.end_date}</span>
        )}
      />
      <Board sprintId={activeSprint?.id || null} currentUser={user} />
    </div>
  );
}
