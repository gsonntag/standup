'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

export default function DependencyPicker({ ticketId, blockers, onAdded }) {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/api/tickets').then((r) => r.json()).then((d) => setTickets(d.tickets || []));
  }, []);

  const blockerIds = new Set(blockers.map((ticket) => ticket.id));
  const matches = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter((ticket) => (
      ticket.id !== ticketId &&
      !blockerIds.has(ticket.id) &&
      (!q || ticket.title.toLowerCase().includes(q) || String(ticket.number).includes(q))
    )).slice(0, 8);
  }, [tickets, search, ticketId, blockers]);

  async function add(ticket) {
    const res = await apiFetch(`/api/tickets/${ticketId}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_id: ticket.id }),
    });
    if (res.ok) onAdded();
  }

  return (
    <div className="label-picker-dropdown">
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets" />
      <div className="mt-md">
        {matches.map((ticket) => (
          <button type="button" key={ticket.id} className="label-picker-item" onClick={() => add(ticket)}>
            <span className="text-mono">#{ticket.number}</span>
            <span>{ticket.title}</span>
          </button>
        ))}
        {!matches.length && <div className="empty">No matching tickets</div>}
      </div>
    </div>
  );
}
