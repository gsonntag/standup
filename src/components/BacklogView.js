'use client';

import { DndContext, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import CreateTicketForm from './CreateTicketForm';
import TicketDetail from './TicketDetail';

function SortableRow({ ticket, movableSprints, onView, onMoveToSprint }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <tr ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <td className="text-mono text-muted">#{ticket.number}</td>
      <td className="backlog-title-cell">
        <button
          type="button"
          className="backlog-title-button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onView(ticket.id); }}
        >
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
        <select
          defaultValue=""
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMoveToSprint(ticket.id, e.target.value)}
        >
          <option value="">move to sprint</option>
          {movableSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
        </select>
      </td>
    </tr>
  );
}

export default function BacklogView() {
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function fetchTickets(fetchOffset = 0) {
    const res = await apiFetch(`/api/tickets?sprint_id=none&limit=50&offset=${fetchOffset}`);
    const data = await res.json();
    if (fetchOffset > 0) {
      setTickets((prev) => [...prev, ...(data.tickets || [])]);
    } else {
      setTickets(data.tickets || []);
    }
    setTotal(data.total || 0);
  }

  useEffect(() => {
    fetchTickets(0);
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
  }, []);

  async function moveToSprint(ticketId, sprintId) {
    if (!sprintId) return;
    setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
    setTotal((prev) => Math.max(0, prev - 1));
    await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprint_id: sprintId, status: 'todo' }),
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTickets((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });

    // Determine before_id from the over ticket's position after move
    const overTicket = tickets.find((t) => t.id === over.id);
    const position = overTicket ? { before_id: over.id } : { index: 0 };

    apiFetch(`/api/tickets/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    }).then((res) => {
      if (!res.ok) fetchTickets(0);
    }).catch(() => fetchTickets(0));
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
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {tickets.map((ticket) => (
                    <SortableRow
                      key={ticket.id}
                      ticket={ticket}
                      movableSprints={movableSprints}
                      onView={setSelectedTicketId}
                      onMoveToSprint={moveToSprint}
                    />
                  ))}
                  {!tickets.length && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">
                          Your backlog is empty.{' '}
                          <button type="button" className="btn btn-sm" onClick={() => setShowCreateForm(true)}>
                            Create a ticket
                          </button>
                          {' '}to get started.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      )}
      {tickets.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const nextOffset = offset + 50;
              setOffset(nextOffset);
              fetchTickets(nextOffset);
            }}
          >
            Load more ({tickets.length}/{total})
          </button>
        </div>
      )}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={({ deleted, updated } = {}) => {
            setSelectedTicketId(null);
            if (deleted || updated) fetchTickets(0);
          }}
        />
      )}
    </div>
  );
}
