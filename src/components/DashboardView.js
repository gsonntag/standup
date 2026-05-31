'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

export default function DashboardView() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [sprint, setSprint] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => {
      const list = d.sprints || [];
      setSprints(list);
      const active = list.find((s) => s.status === 'active');
      setSprintId(active?.id || list[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = sprintId ? `?sprint_id=${sprintId}` : '';
    apiFetch(`/api/dashboard${query}`).then((r) => r.json()).then((d) => {
      setSprint(d.sprint || null);
      setMembers(d.members || []);
      setLoading(false);
    });
  }, [sprintId]);

  const totals = members.reduce((acc, m) => ({
    done: acc.done + m.done,
    in_progress: acc.in_progress + m.in_progress,
    in_review: acc.in_review + m.in_review,
    points_done: acc.points_done + m.points_done,
    total_points: acc.total_points + m.total_points,
  }), { done: 0, in_progress: 0, in_review: 0, points_done: 0, total_points: 0 });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <select value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.status === 'active' ? ' (active)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!sprintId && !loading && (
        <div className="empty">No sprints yet. Create one on the Sprints page.</div>
      )}

      {sprintId && (
        <>
          {sprint && (
            <p className="text-muted text-sm mb-lg">{sprint.start_date} – {sprint.end_date}</p>
          )}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Prod</th>
                  <th>In Progress</th>
                  <th>PR</th>
                  <th>Points Done</th>
                  <th>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-bold">{m.username}</td>
                    <td>{m.done}</td>
                    <td>{m.in_progress}</td>
                    <td>{m.in_review}</td>
                    <td>{m.points_done}</td>
                    <td className="text-muted">{m.total_points}</td>
                  </tr>
                ))}
                {!members.length && !loading && (
                  <tr><td colSpan={6}><div className="empty">No members</div></td></tr>
                )}
              </tbody>
              {members.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="font-bold">Total</td>
                    <td className="font-bold">{totals.done}</td>
                    <td className="font-bold">{totals.in_progress}</td>
                    <td className="font-bold">{totals.in_review}</td>
                    <td className="font-bold">{totals.points_done}</td>
                    <td className="font-bold">{totals.total_points}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
