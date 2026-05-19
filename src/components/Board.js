'use client';

import { DndContext, closestCorners } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { STATUSES } from '@/lib/constants';
import BoardColumn from './BoardColumn';
import TicketDetail from './TicketDetail';

export default function Board({ sprintId, currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);

  async function fetchTickets() {
    const res = await apiFetch(`/api/tickets?sprint_id=${sprintId}`);
    const data = await res.json();
    setTickets(data.tickets || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchTickets();
    apiFetch('/api/users').then((res) => res.json()).then((data) => setUsers(data.users || []));
  }, [sprintId]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const ticketId = active.id;
    const newStatus = over.id;
    const current = tickets.find((ticket) => ticket.id === ticketId);
    if (!current || current.status === newStatus) return;

    setTickets((prev) => prev.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
    )));

    apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).then((res) => {
      if (!res.ok) fetchTickets();
    }).catch(fetchTickets);
  }

  function openTicket(ticketId, editing = false) {
    setSelectedTicket({ id: ticketId, editing });
  }

  async function assignTicket(ticketId, assigneeId) {
    const assignee = users.find((user) => user.id === assigneeId);
    setTickets((prev) => prev.map((ticket) => (
      ticket.id === ticketId
        ? { ...ticket, assignee_id: assigneeId || null, assignee_username: assignee?.username || null }
        : ticket
    )));
    const res = await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assigneeId || null }),
    });
    if (!res.ok) fetchTickets();
  }

  return (
    <>
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="board">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status.value}
              currentUser={currentUser}
              status={status}
              tickets={tickets.filter((ticket) => ticket.status === status.value)}
              users={users}
              onTicketAssign={assignTicket}
              onTicketView={(ticketId) => openTicket(ticketId)}
            />
          ))}
          {loaded && !tickets.length && sprintId && (
            <div className="empty" style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center' }}>
              No tickets in this sprint. Move tickets from the backlog or create new ones.
            </div>
          )}
        </div>
      </DndContext>
      {selectedTicket && (
        <TicketDetail
          ticketId={selectedTicket.id}
          initialEditing={selectedTicket.editing}
          onClose={({ deleted, updated } = {}) => {
            setSelectedTicket(null);
            if (deleted || updated) fetchTickets();
          }}
        />
      )}
    </>
  );
}
