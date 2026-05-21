'use client';

import { DndContext, DragOverlay, pointerWithin, rectIntersection, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { STATUSES } from '@/lib/constants';
import { parseTimestamp } from '@/lib/dates';
import BoardColumn from './BoardColumn';
import TicketCard from './TicketCard';
import TicketDetail from './TicketDetail';
import { useToast, ToastContainer } from './Toast';
import { useRealtime } from '@/lib/realtime';

export default function Board({ sprintId, currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [wipLimits, setWipLimits] = useState({});
  const [swimlane, setSwimlane] = useState('none');
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [wipDraft, setWipDraft] = useState({});
  const { toasts, addToast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function sortTickets(a, b) {
    return a.sort_order - b.sort_order || parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
  }

  async function fetchTickets() {
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
      newLaneField = { assignee_id: newLaneKey === 'unassigned' ? null : newLaneKey };
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

  // Build swimlane groups
  function buildLanes() {
    if (swimlane === 'assignee') {
      const groups = new Map();
      for (const t of tickets) {
        const key = t.assignee_id || 'unassigned';
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
      return lanes;
    } else if (swimlane === 'priority') {
      const groups = new Map();
      for (const t of tickets) {
        const key = t.priority || 'medium';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      const lanes = [];
      for (const [key, laneTickets] of groups) {
        lanes.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), tickets: laneTickets });
      }
      return lanes;
    }
    return [];
  }

  const lanes = swimlane !== 'none' ? buildLanes() : [];

  return (
    <>
      <div className="board-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Swimlanes:&nbsp;
          <select value={swimlane} onChange={(e) => setSwimlane(e.target.value)} style={{ fontSize: '0.8rem' }}>
            <option value="none">None</option>
            <option value="assignee">Assignee</option>
            <option value="priority">Priority</option>
          </select>
        </label>
        {currentUser?.role === 'admin' && sprintId && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowWipSettings((v) => !v)}
            title="WIP Limit Settings"
            style={{ fontSize: '0.8rem' }}
          >
            ⚙ WIP Limits
          </button>
        )}
      </div>

      {showWipSettings && (
        <div className="wip-settings-panel" style={{ background: 'var(--bg-secondary, #f5f5f5)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {STATUSES.map((s) => (
            <label key={s.value} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
              {s.label}
              <input
                type="number"
                min="0"
                style={{ width: '60px', padding: '2px 4px', fontSize: '0.8rem' }}
                value={wipDraft[s.value] || 0}
                onChange={(e) => setWipDraft((prev) => ({ ...prev, [s.value]: Number(e.target.value) }))}
              />
            </label>
          ))}
          <button type="button" className="btn btn-sm" onClick={saveWipLimits}>Save</button>
          <button type="button" className="btn btn-sm" onClick={() => setShowWipSettings(false)}>Cancel</button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {swimlane !== 'none' ? (
          <div className="swimlanes">
            {lanes.map((lane) => (
              <div key={lane.key} className="swimlane">
                <div className="swimlane-label">{lane.label}</div>
                <div className="board">
                  {STATUSES.map((status) => (
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
            <div className="board">
              {STATUSES.map((status) => (
                <BoardColumn
                  key={status.value}
                  currentUser={currentUser}
                  status={status}
                  tickets={tickets.filter((ticket) => ticket.status === status.value).sort(sortTickets)}
                  users={users}
                  onTicketAssign={assignTicket}
                  onTicketView={(ticketId) => openTicket(ticketId)}
                  wipLimit={wipLimits[status.value]}
                />
              ))}
            </div>
            {loaded && !tickets.length && sprintId && (
              <div className="empty" style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center' }}>
                No tickets in this sprint. Move tickets from the backlog or create new ones.
              </div>
            )}
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
    </>
  );
}
