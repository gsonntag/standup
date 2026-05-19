import { getDb } from '@/lib/db';
import { requireCurrentUser } from '@/lib/require-user';
import Board from '@/components/Board';

export default async function BoardPage() {
  const user = await requireCurrentUser();
  const activeSprint = getDb().prepare(
    "SELECT * FROM sprints WHERE status = 'active' LIMIT 1"
  ).get();

  return (
    <div className="page">
      <div className="page-header">
        <h1>{activeSprint ? activeSprint.name : 'Board'}</h1>
        {activeSprint && (
          <span className="text-muted text-sm">
            {activeSprint.start_date} - {activeSprint.end_date}
          </span>
        )}
      </div>
      {!activeSprint ? (
        <div className="empty">
          No active sprint. Go to <a href="/sprints">Sprints</a> to start one.
        </div>
      ) : (
        <Board sprintId={activeSprint.id} currentUser={user} />
      )}
    </div>
  );
}
