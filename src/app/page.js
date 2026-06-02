import { getDb } from '@/lib/db';
import { requireCurrentUser } from '@/lib/require-user';
import Board from '@/components/Board';
import AppPageHeader from '@/components/AppPageHeader';

export default async function BoardPage() {
  const user = await requireCurrentUser();
  const activeSprint = getDb().prepare(
    "SELECT * FROM sprints WHERE status = 'active' LIMIT 1"
  ).get();

  return (
    <div className="page">
      <AppPageHeader
        eyebrow="Board"
        title={activeSprint ? activeSprint.name : 'Board'}
        subtitle={activeSprint ? 'Track active sprint work across status lanes.' : 'Start a sprint to activate the team board.'}
        meta={activeSprint && (
          <span className="linear-date-pill">{activeSprint.start_date} - {activeSprint.end_date}</span>
        )}
      />
      <Board sprintId={activeSprint?.id || null} currentUser={user} />
    </div>
  );
}
