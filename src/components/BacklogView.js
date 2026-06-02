'use client';

import { DndContext, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { labelPillStyle } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CaretDownIcon, CaretUpIcon, DotsSixVerticalIcon, PlusIcon, TicketIcon } from '@phosphor-icons/react';
import AppPageHeader from './AppPageHeader';
import { AppEmptyState } from './AppUI';
import CreateTicketForm from './CreateTicketForm';
import TicketDetail from './TicketDetail';
import TicketFilterBar from './TicketFilterBar';

function SortHeader({ label, value, sort, onSort, className = '', style }) {
  const active = sort.by === value;
  const Icon = active && sort.dir === 'asc' ? CaretUpIcon : CaretDownIcon;
  return (
    <TableHead className={className} style={style}>
      <button
        type="button"
        className={`ticket-sort-header${active ? ' active' : ''}`}
        onClick={() => onSort(value)}
      >
        {label}
        <Icon weight="bold" />
      </button>
    </TableHead>
  );
}

function SortableRow({ ticket, movableSprints, allSprints, onView, onMoveToSprint, selected, onToggleSelect, showSprint, isMoving }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="ticket-row"
      onClick={() => onView(ticket.id)}
    >
      <TableCell onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-9 text-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="ticket-row-drag-cell">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="ticket-row-drag-handle"
          aria-label={`Reorder ${ticket.title}`}
          {...attributes}
          {...listeners}
        >
          <DotsSixVerticalIcon weight="bold" />
        </Button>
      </TableCell>
      <TableCell className="backlog-title-cell">
        <div className="backlog-row-title">
          <span className="ticket-number-pill">#{ticket.number}</span>
          {ticket.title}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={`priority-badge priority-badge-${ticket.priority}`} variant="outline">
          {ticket.priority}
        </Badge>
      </TableCell>
      <TableCell className="text-muted">{ticket.assignee_username || '-'}</TableCell>
      <TableCell>
        <span className="label-list">
          {ticket.labels?.map((label) => (
            <span key={label.id} className="label" style={labelPillStyle(label.color)}>{label.name}</span>
          ))}
        </span>
      </TableCell>
      {showSprint && (
        <TableCell className="text-muted text-xs">
          {ticket.sprint_id ? (ticket.sprint_name || allSprints.find((s) => String(s.id) === String(ticket.sprint_id))?.name || '—') : <em>Backlog</em>}
        </TableCell>
      )}
      <TableCell onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Select
          disabled={isMoving}
          value={ticket.sprint_id ? String(ticket.sprint_id) : 'backlog'}
          onValueChange={async (value) => {
            if (value) await onMoveToSprint(ticket.id, value);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={isMoving ? 'Moving...' : 'Selected sprint'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="backlog">Backlog</SelectItem>
            {ticket.sprint_id && (
              <SelectItem value={String(ticket.sprint_id)} disabled>
                {ticket.sprint_name || allSprints.find((s) => String(s.id) === String(ticket.sprint_id))?.name || 'Current sprint'}
              </SelectItem>
            )}
            {movableSprints
              .filter((s) => String(s.id) !== String(ticket.sprint_id))
              .map((sprint) => <SelectItem key={sprint.id} value={String(sprint.id)}>{sprint.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
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
  const [sort, setSort] = useState({ by: 'number', dir: 'desc' });
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [movingTicketId, setMovingTicketId] = useState(null);
  const debounceTimer = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function buildUrl(fetchOffset = 0, currentFilters = filters, currentScope = scope, currentSort = sort) {
    const params = new URLSearchParams();
    if (currentScope === 'backlog') {
      params.set('sprint_id', 'none');
    }
    if (!currentFilters.status) params.set('exclude_status', 'done');
    params.set('limit', '50');
    params.set('offset', String(fetchOffset));
    if (currentFilters.q) params.set('q', currentFilters.q);
    if (currentFilters.assignee_id) params.set('assignee_id', currentFilters.assignee_id);
    if (currentFilters.priority) params.set('priority', currentFilters.priority);
    if (currentFilters.sprint_id) params.set('sprint_id', currentFilters.sprint_id);
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentSort.by) params.set('sort_by', currentSort.by);
    if (currentSort.dir) params.set('sort_dir', currentSort.dir);
    return `/api/tickets?${params.toString()}`;
  }

  async function fetchTickets(fetchOffset = 0, currentFilters = filters, currentScope = scope, currentSort = sort) {
    const res = await apiFetch(buildUrl(fetchOffset, currentFilters, currentScope, currentSort));
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
      fetchTickets(0, newFilters, scope, sort);
    }, 200);
  }

  function handleScopeChange(newScope) {
    setScope(newScope);
    setOffset(0);
    setSelected(new Set());
    fetchTickets(0, filters, newScope, sort);
  }

  function handleSort(nextBy) {
    const nextSort = {
      by: nextBy,
      dir: sort.by === nextBy
        ? (sort.dir === 'asc' ? 'desc' : 'asc')
        : (nextBy === 'priority' || nextBy === 'number' ? 'desc' : 'asc'),
    };
    setSort(nextSort);
    setOffset(0);
    fetchTickets(0, filters, scope, nextSort);
  }

  function handleSortChange(nextSort) {
    setSort(nextSort);
    setOffset(0);
    fetchTickets(0, filters, scope, nextSort);
  }

  async function moveToSprint(ticketId, sprintId) {
    if (!sprintId) return;
    const newSprintId = sprintId === 'backlog' ? null : sprintId;
    const previousTickets = tickets;
    const previousTotal = total;

    setMovingTicketId(ticketId);
    if (scope === 'backlog' && newSprintId) {
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, sprint_id: newSprintId, status: newSprintId ? 'todo' : 'backlog' } : t));
    }

    try {
      const res = await apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: newSprintId, status: newSprintId ? 'todo' : 'backlog' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to move ticket.');

      if (scope === 'all' && data.ticket) {
        setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, ...data.ticket } : t));
      }
      fetchTickets(0, filters, scope, sort);
    } catch (err) {
      setTickets(previousTickets);
      setTotal(previousTotal);
      alert(err.message);
    } finally {
      setMovingTicketId(null);
    }
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
      if (!res.ok) fetchTickets(0, filters, scope, sort);
    }).catch(() => fetchTickets(0, filters, scope, sort));
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
    fetchTickets(0, filters, scope, sort);
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    await apiFetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, delete: true }),
    });
    setSelected(new Set());
    fetchTickets(0, filters, scope, sort);
  }

  const movableSprints = sprints.filter((sprint) => sprint.status === 'planning' || sprint.status === 'active');

  const showSprint = scope === 'all';

  return (
    <div className="page">
      <AppPageHeader
        icon={TicketIcon}
        eyebrow="Issues"
        title="Tickets"
        subtitle="Triage, assign, and move LA Hacks engineering work."
        actions={(
          <div className="tickets-header-actions">
          <div className="scope-toggle" data-scope={scope}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={scope === 'all'}
              className="scope-toggle-option"
              onClick={() => handleScopeChange('all')}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={scope === 'backlog'}
              className="scope-toggle-option"
              onClick={() => handleScopeChange('backlog')}
            >
              Backlog only
            </Button>
          </div>
          <Button size="sm" className="tickets-new-button" onClick={() => setShowCreateForm(true)}>
            <PlusIcon weight="bold" />
            New ticket
          </Button>
        </div>
        )}
      />
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
            <TicketFilterBar
              filters={filters}
              onChange={handleFiltersChange}
              users={users}
              labels={labels}
              priorities={PRIORITIES}
              statuses={STATUSES}
              sort={sort}
              onSortChange={handleSortChange}
            />
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <Select onValueChange={(value) => handleBulkAction('sprint', value)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Selected sprint..." />
            </SelectTrigger>
            <SelectContent>
              {movableSprints.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="destructive" onClick={handleBulkDelete}>Delete</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="table-container">
          <Table className="backlog-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 36, textAlign: 'center' }}>
                  <Checkbox
                    checked={tickets.length > 0 && selected.size === tickets.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead style={{ width: 36 }} aria-label="Reorder" />
                <SortHeader label="Ticket #" value="number" sort={sort} onSort={handleSort} className="backlog-title-col" />
                <SortHeader label="Priority" value="priority" sort={sort} onSort={handleSort} style={{ width: 120 }} />
                <SortHeader label="Assignee" value="assignee" sort={sort} onSort={handleSort} style={{ width: 140 }} />
                <TableHead style={{ width: 180 }}>Labels</TableHead>
                {showSprint && <SortHeader label="Sprint" value="sprint" sort={sort} onSort={handleSort} style={{ width: 160 }} />}
                <TableHead style={{ width: 180 }}>Selected sprint</TableHead>
              </TableRow>
            </TableHeader>
            <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <TableBody>
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
                    isMoving={movingTicketId === ticket.id}
                  />
                ))}
                {!tickets.length && (
                  <TableRow>
                    <TableCell colSpan={showSprint ? 8 : 7}>
                      {Object.values(filters).some(Boolean) ? (
                        <AppEmptyState
                          icon={TicketIcon}
                          title="No matching tickets"
                          description="Try clearing filters or searching for another issue."
                        />
                      ) : (
                        <AppEmptyState
                          icon={TicketIcon}
                          title={scope === 'all' ? 'No tickets yet' : 'Your backlog is empty'}
                          description="Create a ticket to start triaging LA Hacks engineering work."
                          action={<Button type="button" size="sm" className="tickets-new-button" onClick={() => setShowCreateForm(true)}><PlusIcon weight="bold" />Create a ticket</Button>}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </SortableContext>
          </Table>
        </div>
      </DndContext>
      {tickets.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const nextOffset = offset + 50;
              setOffset(nextOffset);
              fetchTickets(nextOffset, filters, scope, sort);
            }}
          >
            Load more ({tickets.length}/{total})
          </Button>
        </div>
      )}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={({ deleted, updated } = {}) => {
            setSelectedTicketId(null);
            if (deleted || updated) fetchTickets(0, filters, scope, sort);
          }}
        />
      )}
    </div>
  );
}
