'use client';

import { DndContext, DragOverlay, pointerWithin, rectIntersection, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { labelPillStyle } from '@/lib/labels';
import { parseTimestamp } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BoardColumn from './BoardColumn';
import TicketCard from './TicketCard';
import TicketDetail from './TicketDetail';
import { useToast, ToastContainer } from './Toast';
import { useRealtime } from '@/lib/realtime';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleIcon,
  FireIcon,
  FlagIcon,
  KanbanIcon,
  ListBulletsIcon,
  RocketLaunchIcon,
  SlidersHorizontalIcon,
  SpinnerGapIcon,
  SquaresFourIcon,
  TimerIcon,
} from '@phosphor-icons/react';

const STATUS_ICONS = {
  backlog: KanbanIcon,
  todo: CircleIcon,
  in_progress: SpinnerGapIcon,
  in_review: TimerIcon,
  done: RocketLaunchIcon,
};

const PRIORITY_ICONS = {
  low: ArrowDownIcon,
  medium: FlagIcon,
  high: ArrowUpIcon,
  urgent: FireIcon,
};

const BOARD_LIST_COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'labels', label: 'Labels' },
  { key: 'assignees', label: 'Assignees' },
  { key: 'created', label: 'Created' },
  { key: 'due', label: 'Due' },
];

function formatBoardDate(value) {
  const date = parseTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function assigneesForTicket(ticket) {
  return ticket.assignees?.length
    ? ticket.assignees
    : ticket.assignee_id
      ? [{ id: ticket.assignee_id, username: ticket.assignee_username }]
      : [];
}

function StatusGroupHeader({ status, tickets }) {
  const StatusIcon = STATUS_ICONS[status.value] || CircleIcon;
  return (
    <div className={`linear-group-header linear-group-${status.value}`}>
      <div className="linear-group-title">
        <StatusIcon weight="fill" />
        <span>{status.label}</span>
        <strong>{tickets.length}</strong>
      </div>
      <button type="button" className="linear-group-add" aria-label={`Add issue to ${status.label}`}>+</button>
    </div>
  );
}

function BoardListView({ tickets, visibleColumns, onOpenTicket }) {
  const groupedTickets = STATUSES
    .map((status) => ({
      status,
      tickets: tickets.filter((ticket) => ticket.status === status.value),
    }))
    .filter((group) => group.tickets.length);

  return (
    <div className="board-list-shell">
      {groupedTickets.map(({ status, tickets: groupTickets }) => (
        <section key={status.value} className="linear-list-group">
          <StatusGroupHeader status={status} tickets={groupTickets} />
          <div className="linear-list-rows">
            {groupTickets.map((ticket) => {
              const priorityMeta = PRIORITIES.find((priority) => priority.value === ticket.priority);
              const StatusIcon = STATUS_ICONS[ticket.status] || CircleIcon;
              const PriorityIcon = PRIORITY_ICONS[ticket.priority] || FlagIcon;
              const assignees = assigneesForTicket(ticket);
              return (
                <button key={ticket.id} type="button" className="linear-list-row" onClick={() => onOpenTicket(ticket.id)}>
                  <span className="linear-list-id">#{ticket.number}</span>
                  {visibleColumns.status && (
                    <span className={`ticket-card-status-icon status-icon-${ticket.status}`}>
                      <StatusIcon weight="fill" />
                    </span>
                  )}
                  <span className="linear-list-title">{ticket.title}</span>
                  <span className="linear-list-meta">
                    {visibleColumns.priority && (
                      <span className={`linear-priority-chip linear-priority-${ticket.priority}`}>
                        <span className="linear-priority-dot" />
                        <PriorityIcon weight="bold" />
                        {priorityMeta?.label || ticket.priority}
                      </span>
                    )}
                    {visibleColumns.labels && ticket.labels?.map((label) => (
                      <span key={label.id} className="label linear-label" style={labelPillStyle(label.color)}>
                        <span className="linear-label-dot" />
                        {label.name}
                      </span>
                    ))}
                    {visibleColumns.assignees && (
                      <span className="linear-muted-chip">{assignees.length ? assignees.map((assignee) => `@${assignee.username}`).join(', ') : 'Unassigned'}</span>
                    )}
                    {visibleColumns.created && <span className="linear-muted-chip">{formatBoardDate(ticket.created_at)}</span>}
                    {visibleColumns.due && ticket.due_date && <span className="linear-muted-chip">Due {formatBoardDate(ticket.due_date)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!groupedTickets.length && <div className="board-list-empty">No issues in this view.</div>}
    </div>
  );
}

function HiddenColumnsRail({ statuses, onRestore }) {
  if (!statuses.length) return null;
  return (
    <aside className="hidden-columns-rail">
      <div className="hidden-columns-title">
        <span>Hidden columns</span>
      </div>
      <div className="hidden-columns-list">
        {statuses.map((status) => {
          const StatusIcon = STATUS_ICONS[status.value] || CircleIcon;
          return (
            <button key={status.value} type="button" className="hidden-column-card" onClick={() => onRestore(status.value)}>
              <StatusIcon weight="fill" />
              <span>{status.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default function Board({ sprintId, currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [wipLimits, setWipLimits] = useState({});
  const [swimlane, setSwimlane] = useState('none');
  const [view, setView] = useState('all');
  const [boardMode, setBoardMode] = useState('board');
  const [visibleColumns, setVisibleColumns] = useState(() => Object.fromEntries(BOARD_LIST_COLUMNS.map((column) => [column.key, true])));
  const [visibleStatuses, setVisibleStatuses] = useState(() => Object.fromEntries(STATUSES.map((status) => [status.value, status.value !== 'backlog'])));
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [wipDraft, setWipDraft] = useState({});
  const { toasts, addToast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function sortTickets(a, b) {
    return a.sort_order - b.sort_order || parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
  }

  function priorityRank(priority) {
    return { urgent: 4, high: 3, medium: 2, low: 1 }[priority] || 0;
  }

  async function fetchTickets() {
    if (!sprintId) {
      setTickets([]);
      setLoaded(true);
      return;
    }
    const res = await apiFetch(`/api/tickets?sprint_id=${sprintId}`);
    const data = await res.json();
    setTickets(data.tickets || []);
    setLoaded(true);
  }

  async function fetchWipLimits() {
    if (!sprintId) return;
    const res = await apiFetch(`/api/sprints/${sprintId}/wip`);
    const data = await res.json();
    const limitsMap = {};
    for (const { status, max_count } of (data.limits || [])) {
      limitsMap[status] = max_count;
    }
    setWipLimits(limitsMap);
    // Initialize wip draft from current limits
    const draft = {};
    for (const s of STATUSES) {
      draft[s.value] = limitsMap[s.value] || 0;
    }
    setWipDraft(draft);
  }

  useEffect(() => {
    fetchTickets();
    apiFetch('/api/users').then((res) => res.json()).then((data) => setUsers(data.users || []));
    fetchWipLimits();
  }, [sprintId]);

  useRealtime((event) => { if (event.kind === 'ticket') fetchTickets(); });

  function collisionDetection(args) {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
  }

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

    // Parse lane-prefixed droppable ids (e.g. "laneKey__status")
    function parseOverId(id) {
      if (typeof id === 'string' && id.includes('__')) {
        const idx = id.indexOf('__');
        return { laneKey: id.substring(0, idx), statusValue: id.substring(idx + 2) };
      }
      return { laneKey: null, statusValue: id };
    }

    let newStatus;
    let beforeId = null;
    let newLaneKey = null;
    let newLaneField = null;

    const overIdStr = String(over.id);
    if (overIdStr.includes('__')) {
      // Dropped onto a lane column droppable
      const parsed = parseOverId(overIdStr);
      newStatus = parsed.statusValue;
      newLaneKey = parsed.laneKey;
    } else if (statusValues.has(overIdStr)) {
      newStatus = overIdStr;
    } else {
      // Dropped onto another ticket
      const overTicket = tickets.find((t) => t.id === over.id);
      if (!overTicket) return;
      newStatus = overTicket.status;
      beforeId = over.id;
    }

    const isSameColumn = current.status === newStatus;

    if (isSameColumn && !beforeId && !newLaneKey) return;

    // Determine lane field update
    if (swimlane === 'assignee' && newLaneKey !== null) {
      const nextAssigneeIds = newLaneKey === 'unassigned'
        ? []
        : [...new Set([newLaneKey, ...(current.assignees || []).map((assignee) => assignee.id)])];
      newLaneField = { assignee_id: nextAssigneeIds[0] || null, assignee_ids: nextAssigneeIds };
    } else if (swimlane === 'priority' && newLaneKey !== null) {
      newLaneField = { priority: newLaneKey };
    }

    // Snapshot for rollback
    const prevTickets = tickets;

    // Optimistic update
    setTickets((prev) => {
      const updatedFields = { status: newStatus, ...(newLaneField || {}) };
      if (isSameColumn && !newLaneField) {
        // Reorder within column
        const colTickets = prev.filter((t) => t.status === newStatus).sort(sortTickets);
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
        return prev.map((t) => t.id === ticketId ? { ...t, ...updatedFields } : t);
      }
    });

    const patchBody = isSameColumn && !newLaneField
      ? { position: { before_id: beforeId } }
      : { status: newStatus, position: { before_id: beforeId }, ...(newLaneField || {}) };

    apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    }).then(async (res) => {
      if (!res.ok) {
        let errMsg = 'Server rejected the change';
        try {
          const data = await res.json();
          if (data.error) errMsg = data.error;
        } catch (_) {}
        addToast(`Failed to move ticket: ${errMsg}`);
        setTickets(prevTickets);
      }
    }).catch((err) => {
      addToast(`Failed to move ticket: ${err.message || 'Network error'}`);
      setTickets(prevTickets);
    });
  }

  function openTicket(ticketId, editing = false) {
    setSelectedTicket({ id: ticketId, editing });
  }

  function handleBoardWheel(event) {
    const board = event.currentTarget;
    const columnBody = event.target.closest?.('.board-column-body');
    const deltaY = event.deltaY || 0;
    const deltaX = event.deltaX || 0;
    const canScrollBoard = board.scrollWidth > board.clientWidth + 1;
    if (!canScrollBoard) return;

    if (columnBody && board.contains(columnBody) && Math.abs(deltaY) > Math.abs(deltaX)) {
      const canScrollColumn = columnBody.scrollHeight > columnBody.clientHeight + 1;
      const atTop = columnBody.scrollTop <= 0;
      const atBottom = columnBody.scrollTop + columnBody.clientHeight >= columnBody.scrollHeight - 1;
      if (canScrollColumn && ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom))) {
        return;
      }
    }

    const horizontalDelta = deltaX || deltaY;
    if (!horizontalDelta) return;
    event.preventDefault();
    board.scrollLeft += horizontalDelta;
  }

  async function assignTicket(ticketId, assigneeIds) {
    const nextAssigneeIds = Array.isArray(assigneeIds) ? assigneeIds : (assigneeIds ? [assigneeIds] : []);
    const assignees = nextAssigneeIds
      .map((assigneeId) => users.find((user) => user.id === assigneeId))
      .filter(Boolean);
    const primary = assignees[0] || null;
    setTickets((prev) => prev.map((ticket) => (
      ticket.id === ticketId
        ? { ...ticket, assignee_id: primary?.id || null, assignee_username: primary?.username || null, assignees }
        : ticket
    )));
    const res = await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_ids: nextAssigneeIds }),
    });
    if (!res.ok) fetchTickets();
  }

  async function saveWipLimits() {
    const limits = Object.entries(wipDraft)
      .filter(([, v]) => v > 0)
      .map(([status, max_count]) => ({ status, max_count: Number(max_count) }));
    const res = await apiFetch(`/api/sprints/${sprintId}/wip`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limits }),
    });
    if (res.ok) {
      const newLimits = {};
      for (const { status, max_count } of limits) {
        newLimits[status] = max_count;
      }
      setWipLimits(newLimits);
      setShowWipSettings(false);
      addToast('WIP limits saved.', 'success');
    } else {
      addToast('Failed to save WIP limits.');
    }
  }

  const visibleTickets = view === 'mine' && currentUser
    ? tickets.filter((t) => t.assignee_id === currentUser.id || t.assignees?.some((assignee) => assignee.id === currentUser.id))
    : tickets;

  // Build swimlane groups
  function buildLanes() {
    if (swimlane === 'assignee') {
      const groups = new Map();
      for (const t of visibleTickets) {
        const key = t.assignee_id || t.assignees?.[0]?.id || 'unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      const lanes = [];
      for (const [key, laneTickets] of groups) {
        const user = users.find((u) => u.id === key);
        lanes.push({
          key,
          label: user ? user.username : 'Unassigned',
          tickets: laneTickets,
        });
      }
      return lanes.sort((a, b) => a.label.localeCompare(b.label));
    } else if (swimlane === 'priority') {
      const groups = new Map();
      for (const t of visibleTickets) {
        const key = t.priority || 'medium';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      const lanes = [];
      for (const [key, laneTickets] of groups) {
        lanes.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), tickets: laneTickets });
      }
      return lanes.sort((a, b) => priorityRank(b.key) - priorityRank(a.key));
    }
    return [];
  }

  const lanes = swimlane !== 'none' ? buildLanes() : [];
  const shownStatuses = STATUSES.filter((status) => visibleStatuses[status.value]);
  const hiddenStatuses = STATUSES.filter((status) => !visibleStatuses[status.value]);

  return (
    <div className={`board-shell${swimlane !== 'none' && boardMode === 'board' ? ' board-shell-swimlanes' : ''}${boardMode === 'list' ? ' board-shell-list' : ''}`}>
      <div className="board-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div className="btn-group">
          <Button type="button" size="sm" variant={view === 'all' ? 'default' : 'outline'} onClick={() => setView('all')}>Whole Sprint</Button>
          <Button type="button" size="sm" variant={view === 'mine' ? 'default' : 'outline'} onClick={() => setView('mine')}>My Tickets</Button>
        </div>
        <div className="linear-view-switch">
          <Button type="button" size="sm" variant={boardMode === 'list' ? 'default' : 'outline'} onClick={() => setBoardMode('list')}>
            <ListBulletsIcon weight="bold" />
            List
          </Button>
          <Button type="button" size="sm" variant={boardMode === 'board' ? 'default' : 'outline'} onClick={() => setBoardMode('board')}>
            <SquaresFourIcon weight="bold" />
            Board
          </Button>
        </div>
        {boardMode === 'board' && (
          <Select value={swimlane} onValueChange={setSwimlane}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No swimlanes</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="outline" className="linear-icon-control" title="Display options">
              <SlidersHorizontalIcon weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="board-columns-menu linear-display-menu">
            <DropdownMenuLabel>Display properties</DropdownMenuLabel>
            {boardMode === 'board' && (
              <>
                <DropdownMenuLabel>Board columns</DropdownMenuLabel>
                {STATUSES.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status.value}
                    checked={visibleStatuses[status.value]}
                    onCheckedChange={(checked) => {
                      setVisibleStatuses((prev) => ({ ...prev, [status.value]: Boolean(checked) }));
                    }}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {status.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
            {boardMode === 'list' && BOARD_LIST_COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={visibleColumns[column.key]}
                onCheckedChange={(checked) => {
                  setVisibleColumns((prev) => ({ ...prev, [column.key]: Boolean(checked) }));
                }}
                onSelect={(event) => event.preventDefault()}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {currentUser?.role === 'admin' && sprintId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowWipSettings((v) => !v)}
            title="WIP Limit Settings"
          >
            WIP limits
          </Button>
        )}
      </div>

      {showWipSettings && (
        <Card className="wip-settings-panel mb-3">
          <CardContent className="flex flex-wrap items-end gap-4 pt-4">
            {STATUSES.map((s) => (
              <div key={s.value} className="grid gap-1">
                <Label>{s.label}</Label>
                <Input
                  type="number"
                  min="0"
                  className="w-20"
                  value={wipDraft[s.value] || 0}
                  onChange={(e) => setWipDraft((prev) => ({ ...prev, [s.value]: Number(e.target.value) }))}
                />
              </div>
            ))}
            <Button type="button" size="sm" onClick={saveWipLimits}>Save</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowWipSettings(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {boardMode === 'list' ? (
        <BoardListView
          tickets={[...visibleTickets].sort((a, b) => {
            const statusOrder = STATUSES.findIndex((status) => status.value === a.status) - STATUSES.findIndex((status) => status.value === b.status);
            return statusOrder || sortTickets(a, b);
          })}
          visibleColumns={visibleColumns}
          onOpenTicket={(ticketId) => openTicket(ticketId)}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {swimlane !== 'none' ? (
            <div className="swimlanes" onWheel={handleBoardWheel}>
              {lanes.map((lane) => (
                <div key={lane.key} className="swimlane">
                  <div className="swimlane-label">{lane.label}</div>
                  <div className="board">
                    {shownStatuses.map((status) => (
                      <BoardColumn
                        key={`${lane.key}-${status.value}`}
                        currentUser={currentUser}
                        status={{ ...status, value: `${lane.key}__${status.value}` }}
                        tickets={lane.tickets.filter((t) => t.status === status.value).sort(sortTickets)}
                        users={users}
                        onTicketAssign={assignTicket}
                        onTicketView={(ticketId) => openTicket(ticketId)}
                        wipLimit={wipLimits[status.value]}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {loaded && !visibleTickets.length && (
                <div className="board-empty-banner">
                  <strong>{sprintId ? 'This sprint is ready for tickets.' : 'No active sprint yet.'}</strong>
                  <span>
                    {view === 'mine'
                      ? 'No tickets are assigned to you in this view.'
                      : sprintId
                        ? 'Move issues from Tickets into this sprint or add them while editing the sprint.'
                        : 'Start a sprint from the Sprints page to make this board active.'}
                  </span>
                </div>
              )}
              <div className={`board${loaded && !visibleTickets.length ? ' board-empty' : ''}`} onWheel={handleBoardWheel}>
                {shownStatuses.map((status) => (
                  <BoardColumn
                    key={status.value}
                    currentUser={currentUser}
                    status={status}
                    tickets={visibleTickets.filter((ticket) => ticket.status === status.value).sort(sortTickets)}
                    users={users}
                    onTicketAssign={assignTicket}
                    onTicketView={(ticketId) => openTicket(ticketId)}
                    wipLimit={wipLimits[status.value]}
                  />
              ))}
              <HiddenColumnsRail
                statuses={hiddenStatuses}
                onRestore={(statusValue) => setVisibleStatuses((prev) => ({ ...prev, [statusValue]: true }))}
              />
            </div>
            </>
          )}
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
      )}
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
      <ToastContainer toasts={toasts} />
    </div>
  );
}
