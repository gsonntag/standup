'use client';

import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { STATUSES } from '@/lib/constants';
import BoardColumn from './BoardColumn';
import TicketCard from './TicketCard';
import TicketDetail from './TicketDetail';

export default function Board({ sprintId, currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  function handleDragStart(event) {
    const { active } = event;
    setActiveTicket(tickets.find((t) => t.id === active.id) || null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const ticketId = active.id;
    const current = tickets.find((t) => t.id === ticketId);
    if (!current) return;

    const statusValues = new Set(STATUSES.map((s) => s.value));

    // Determine target status: over.id could be a status column or another ticket id
    let newStatus;
    let beforeId = null;

    if (statusValues.has(over.id)) {
      // Dropped onto a column droppable
      newStatus = over.id;
    } else {
      // Dropped onto another ticket — find that ticket's status
      const overTicket = tickets.find((t) => t.id === over.id);
      if (!overTicket) return;
      newStatus = overTicket.status;
      beforeId = over.id;
    }

    const isSameColumn = current.status === newStatus;

    if (isSameColumn && !beforeId) return; // no-op drop on same column header

    // Optimistic update
    setTickets((prev) => {
      if (isSameColumn) {
        // Reorder within column
        const colTickets = prev.filter((t) => t.status === newStatus).sort((a, b) => a.sort_order - b.sort_order || new Date(b.created_at) - new Date(a.created_at));
        const oldIdx = colTickets.findIndex((t) => t.id === ticketId);
        const newIdx = colTickets.findIndex((t) => t.id === beforeId);
        if (oldIdx === -1 || newIdx === -1) return prev;
        const reordered = arrayMove(colTickets, oldIdx, newIdx);
        const reorderedIds = new Set(reordered.map((t) => t.id));
        return [
          ...prev.filter((t) => !reorderedIds.has(t.id)),
          ...reordered.map((t, i) => ({ ...t, sort_order: (i + 1) * 1024 })),
        ];
      } else {
        return prev.map((t) => t.id === ticketId ? { ...t, status: newStatus } : t);
      }
    });

    const patchBody = isSameColumn
      ? { position: { before_id: beforeId } }
      : { status: newStatus, position: { before_id: beforeId } };

    apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
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
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="board">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status.value}
              currentUser={currentUser}
              status={status}
              tickets={tickets.filter((ticket) => ticket.status === status.value).sort((a, b) => a.sort_order - b.sort_order || new Date(b.created_at) - new Date(a.created_at))}
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
        <DragOverlay>
          {activeTicket ? (
            <TicketCard
              ticket={activeTicket}
              users={users}
              onAssign={() => {}}
              onView={() => {}}
            />
          ) : null}
        </DragOverlay>
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
