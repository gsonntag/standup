'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import CreateTicketForm from './CreateTicketForm';
import TicketDetail from './TicketDetail';

export default function BacklogView() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  async function fetchTickets() {
    const res = await apiFetch('/api/tickets?sprint_id=none');
    const data = await res.json();
    setTickets(data.tickets || []);
  }

  useEffect(() => {
    fetchTickets();
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
  }, []);

  async function moveToSprint(ticketId, sprintId) {
    if (!sprintId) return;
    setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
    await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprint_id: sprintId, status: 'todo' }),
    });
  }

  const movableSprints = sprints.filter((sprint) => sprint.status === 'planning' || sprint.status === 'active');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Backlog</h1>
        <button className="btn btn-sm" onClick={() => setShowCreateForm(true)}>+ New Ticket</button>
      </div>
      {showCreateForm && (
        <CreateTicketForm
          users={users}
          onCreated={(ticket) => {
            setTickets((prev) => [ticket, ...prev]);
            setShowCreateForm(false);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
      {!showCreateForm && (
        <div className="table-container">
          <table className="backlog-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th className="backlog-title-col">Title</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 100 }}>Assignee</th>
                <th style={{ width: 160 }}>Labels</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="text-mono text-muted">#{ticket.number}</td>
                  <td className="backlog-title-cell">
                    <button type="button" className="backlog-title-button" onClick={() => setSelectedTicketId(ticket.id)}>
                      {ticket.title}
                    </button>
                  </td>
                  <td><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span></td>
                  <td className="text-muted">{ticket.assignee_username || '-'}</td>
                  <td>
                    <span className="label-list">
                      {ticket.labels?.map((label) => (
                        <span key={label.id} className="label" style={{ backgroundColor: label.color }}>{label.name}</span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <select defaultValue="" onChange={(e) => moveToSprint(ticket.id, e.target.value)}>
                      <option value="">move to sprint</option>
                      {movableSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!tickets.length && (
                <tr><td colSpan={6}><div className="empty">No tickets</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={({ deleted, updated } = {}) => {
            setSelectedTicketId(null);
            if (deleted || updated) fetchTickets();
          }}
        />
      )}
    </div>
  );
}
