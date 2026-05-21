'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import TicketDetail from '@/components/TicketDetail';

export default function MyTasksView({ currentUser }) {
  const [data, setData] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  async function fetchData() {
    const res = await apiFetch('/api/me/tasks');
    const d = await res.json();
    setData(d);
  }

  useEffect(() => { fetchData(); }, []);

  if (!data) return <div className="page"><div className="empty">Loading…</div></div>;

  return (
    <div className="page">
      <div className="page-header"><h1>My Tasks</h1></div>

      <section className="mb-lg">
        <h2 className="mb-md">Assigned to me</h2>
        {data.assigned.length === 0 ? (
          <div className="empty">Nothing assigned to you.</div>
        ) : (
          <div className="table-container">
            <table className="backlog-table">
              <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {data.assigned.map((t) => (
                  <tr key={t.id}>
                    <td className="text-mono text-muted">#{t.number}</td>
                    <td><button type="button" className="backlog-title-button" onClick={() => setSelectedTicketId(t.id)}>{t.title}</button></td>
                    <td><span className={`priority priority-${t.status}`}>{t.status}</span></td>
                    <td className="text-muted">{t.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-lg">
        <h2 className="mb-md">Mentions</h2>
        {data.mentions.length === 0 ? (
          <div className="empty">No mentions.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.mentions.map((m) => (
              <li key={m.mention_id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <button type="button" className="backlog-title-button" onClick={() => setSelectedTicketId(m.ticket_id)}>
                  #{m.ticket_number} {m.ticket_title}
                </button>
                <span className="text-muted" style={{ marginLeft: '0.5rem' }}>{timeAgo(m.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-lg">
        <h2 className="mb-md">Watching</h2>
        {data.watching.length === 0 ? (
          <div className="empty">No recent activity on watched tickets.</div>
        ) : (
          <div className="table-container">
            <table className="backlog-table">
              <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                {data.watching.map((t) => (
                  <tr key={t.id}>
                    <td className="text-mono text-muted">#{t.number}</td>
                    <td><button type="button" className="backlog-title-button" onClick={() => setSelectedTicketId(t.id)}>{t.title}</button></td>
                    <td><span className={`priority priority-${t.status}`}>{t.status}</span></td>
                    <td className="text-muted">{timeAgo(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-lg">
        <h2 className="mb-md">Blockers cleared</h2>
        {data.blockers_cleared.length === 0 ? (
          <div className="empty">No recently unblocked tickets.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.blockers_cleared.map((t) => (
              <li key={t.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <button type="button" className="backlog-title-button" onClick={() => setSelectedTicketId(t.id)}>
                  #{t.number} {t.title}
                </button>
                <span className="text-muted" style={{ marginLeft: '0.5rem' }}>— {t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => { setSelectedTicketId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
