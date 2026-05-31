'use client';

import { DndContext, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES } from '@/lib/constants';
import CreateTicketForm from './CreateTicketForm';
import TicketDetail from './TicketDetail';
import TicketFilterBar from './TicketFilterBar';

function SortableRow({ ticket, movableSprints, allSprints, onView, onMoveToSprint, selected, onToggleSelect, showSprint }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <tr ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <td onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ width: 36, textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
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
      {showSprint && (
        <td className="text-muted" style={{ fontSize: '0.8125rem' }}>
          {ticket.sprint_id ? (allSprints.find((s) => s.id === ticket.sprint_id)?.name || '—') : <em>Backlog</em>}
        </td>
      )}
      <td>
        <select
          defaultValue=""
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMoveToSprint(ticket.id, e.target.value)}
        >
          <option value="">{ticket.sprint_id ? 'move to…' : 'move to sprint'}</option>
          {ticket.sprint_id && <option value="backlog">Backlog</option>}
          {movableSprints.filter((s) => s.id !== ticket.sprint_id).map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
        </select>
      </td>
    </tr>
  );
}

export default function BacklogView() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [labels, setLabels] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [filters, setFilters] = useState({});
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const debounceTimer = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function buildUrl(fetchOffset = 0, currentFilters = filters, currentScope = scope) {
    const params = new URLSearchParams();
    if (currentScope === 'backlog') {
      params.set('sprint_id', 'none');
      params.set('exclude_status', 'done');
    }
    params.set('limit', '50');
    params.set('offset', String(fetchOffset));
    if (currentFilters.q) params.set('q', currentFilters.q);
    if (currentFilters.assignee_id) params.set('assignee_id', currentFilters.assignee_id);
    if (currentFilters.priority) params.set('priority', currentFilters.priority);
    return `/api/tickets?${params.toString()}`;
  }

  async function fetchTickets(fetchOffset = 0, currentFilters = filters, currentScope = scope) {
    const res = await apiFetch(buildUrl(fetchOffset, currentFilters, currentScope));
    const data = await res.json();
    if (fetchOffset > 0) {
      setTickets((prev) => [...prev, ...(data.tickets || [])]);
    } else {
      setTickets(data.tickets || []);
      setSelected(new Set());
    }
    setTotal(data.total || 0);
  }

  useEffect(() => {
    const ticketParam = searchParams.get('ticket');
    if (ticketParam) setSelectedTicketId(parseInt(ticketParam, 10));
    fetchTickets(0);
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
    apiFetch('/api/labels').then((r) => r.json()).then((d) => setLabels(d.labels || []));
  }, []);

  function handleFiltersChange(newFilters) {
    setFilters(newFilters);
    setOffset(0);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchTickets(0, newFilters, scope);
    }, 200);
  }

  function handleScopeChange(newScope) {
    setScope(newScope);
    setOffset(0);
    setSelected(new Set());
    fetchTickets(0, filters, newScope);
  }

  async function moveToSprint(ticketId, sprintId) {
    if (!sprintId) return;
    if (scope === 'backlog') {
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      const newSprintId = sprintId === 'backlog' ? null : sprintId;
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, sprint_id: newSprintId } : t));
    }
    const newSprintId = sprintId === 'backlog' ? null : sprintId;
    await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprint_id: newSprintId, status: newSprintId ? 'todo' : 'backlog' }),
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

  function toggleSelectAll() {
    if (selected.size === tickets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tickets.map((t) => t.id)));
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkAction(type, value) {
    if (!value) return;
    const ids = [...selected];
    if (type === 'sprint') {
      await apiFetch('/api/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, set: { sprint_id: value, status: 'todo' } }),
      });
    }
    setSelected(new Set());
    fetchTickets(0);
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    await apiFetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, delete: true }),
    });
    setSelected(new Set());
    fetchTickets(0);
  }

  const movableSprints = sprints.filter((sprint) => sprint.status === 'planning' || sprint.status === 'active');

  const showSprint = scope === 'all';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tickets</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="btn-group">
            <button type="button" className={`btn btn-sm${scope === 'all' ? ' btn-active' : ''}`} onClick={() => handleScopeChange('all')}>All</button>
            <button type="button" className={`btn btn-sm${scope === 'backlog' ? ' btn-active' : ''}`} onClick={() => handleScopeChange('backlog')}>Backlog only</button>
          </div>
          <button className="btn btn-sm" onClick={() => setShowCreateForm(true)}>+ New Ticket</button>
        </div>
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
        <>
          <TicketFilterBar
            filters={filters}
            onChange={handleFiltersChange}
            users={users}
            labels={labels}
            priorities={PRIORITIES}
          />
          {selected.size > 0 && (
            <div className="bulk-bar">
              <span>{selected.size} selected</span>
              <select onChange={(e) => handleBulkAction('sprint', e.target.value)} defaultValue="">
                <option value="">Move to sprint…</option>
                {movableSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" className="btn btn-sm" onClick={handleBulkDelete}>Delete</button>
              <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="table-container">
              <table className="backlog-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={tickets.length > 0 && selected.size === tickets.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="backlog-title-col">Title</th>
                    <th style={{ width: 90 }}>Priority</th>
                    <th style={{ width: 100 }}>Assignee</th>
                    <th style={{ width: 160 }}>Labels</th>
                    {showSprint && <th style={{ width: 140 }}>Sprint</th>}
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {tickets.map((ticket) => (
                      <SortableRow
                        key={ticket.id}
                        ticket={ticket}
                        movableSprints={movableSprints}
                        allSprints={sprints}
                        onView={setSelectedTicketId}
                        onMoveToSprint={moveToSprint}
                        selected={selected.has(ticket.id)}
                        onToggleSelect={() => toggleSelect(ticket.id)}
                        showSprint={showSprint}
                      />
                    ))}
                    {!tickets.length && (
                      <tr>
                        <td colSpan={showSprint ? 7 : 6}>
                          <div className="empty">
                            {Object.values(filters).some(Boolean)
                              ? 'No tickets match your filters.'
                              : scope === 'all'
                                ? <>No tickets yet.{' '}<button type="button" className="btn btn-sm" onClick={() => setShowCreateForm(true)}>Create a ticket</button>{' '}to get started.</>
                                : <>Your backlog is empty.{' '}<button type="button" className="btn btn-sm" onClick={() => setShowCreateForm(true)}>Create a ticket</button>{' '}to get started.</>
                            }
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          </DndContext>
        </>
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
