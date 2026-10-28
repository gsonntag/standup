'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Divider } from '@astryxdesign/core/Divider';
import { apiFetch } from '@/lib/client-api';
import TicketDetail from './TicketDetail';
import CreateTicketForm from './CreateTicketForm';

const COLUMNS = [
  {
    id: 'todo',
    title: 'To Do',
    variant: 'warning',
    emptyTitle: 'To Do is empty',
    emptyDescription: 'Tickets ready for work appear here.',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    variant: 'accent',
    emptyTitle: 'Nothing in progress',
    emptyDescription: 'Tickets actively being worked on.',
  },
  {
    id: 'in_review',
    title: 'In Review',
    variant: 'warning',
    emptyTitle: 'Nothing in review',
    emptyDescription: 'Tickets awaiting peer review.',
  },
  {
    id: 'done',
    title: 'Done',
    variant: 'success',
    emptyTitle: 'Nothing done yet',
    emptyDescription: 'Completed tickets appear here.',
  },
];

const PRIORITY_BADGES = {
  urgent: { label: 'Urgent', variant: 'error' },
  high: { label: 'High', variant: 'error' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'neutral' },
};

export default function AstryxBoard({ sprintId: initialSprintId, currentUser }) {
  const [sprintId, setSprintId] = useState(initialSprintId ? String(initialSprintId) : '');
  const [sprints, setSprints] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(null);

  // Load sprints
  useEffect(() => {
    apiFetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.sprints || [];
        setSprints(list);
        if (!sprintId && list.length > 0) {
          const active = list.find((s) => s.status === 'active') || list[0];
          setSprintId(String(active.id));
        }
      })
      .catch(() => {});
  }, []);

  // Load users
  useEffect(() => {
    apiFetch('/api/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  // Load tickets for active sprint
  const fetchTickets = () => {
    const url = sprintId ? `/api/tickets?sprint_id=${sprintId}` : '/api/tickets';
    apiFetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTickets(Array.isArray(data) ? data : data.tickets || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchTickets();
  }, [sprintId]);

  // Move ticket status
  async function moveTicket(ticketId, nextStatus) {
    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
    );

    try {
      await apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchTickets();
    } catch (_) {
      fetchTickets();
    }
  }

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = ticket.title?.toLowerCase().includes(q);
        const matchesNum = String(ticket.number).includes(q);
        if (!matchesTitle && !matchesNum) return false;
      }
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' && ticket.assignee_id) return false;
        if (assigneeFilter !== 'unassigned' && String(ticket.assignee_id) !== String(assigneeFilter)) return false;
      }
      return true;
    });
  }, [tickets, search, priorityFilter, assigneeFilter]);

  // Group by column
  const ticketsByColumn = useMemo(() => {
    const map = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const t of filteredTickets) {
      const col = t.status === 'backlog' ? 'todo' : t.status;
      if (map[col]) {
        map[col].push(t);
      } else {
        map.todo.push(t);
      }
    }
    return map;
  }, [filteredTickets]);

  const activeSprint = sprints.find((s) => String(s.id) === String(sprintId));

  return (
    <Layout height="fill" contentWidth="fill">
      {/* Top Board Toolbar */}
      <LayoutHeader hasDivider padding={4}>
        <VStack gap={3}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
            <HStack gap={3} vAlign="center">
              <Heading level={2}>
                {activeSprint ? activeSprint.name : 'Sprint Board'}
              </Heading>
              <Badge label={`${filteredTickets.length} tickets`} variant="neutral" />
            </HStack>

            <HStack gap={2} vAlign="center">
              {sprints.length > 0 && (
                <Selector
                  label="Sprint"
                  isLabelHidden
                  value={sprintId}
                  onChange={(v) => setSprintId(String(v))}
                  options={sprints.map((s) => ({
                    value: String(s.id),
                    label: s.status === 'active' ? `${s.name} (Active)` : s.name,
                  }))}
                />
              )}
              <Button
                variant="primary"
                label="+ New Ticket"
                onClick={() => setIsCreateOpen(true)}
              />
            </HStack>
          </HStack>

          {/* Filters Bar */}
          <HStack gap={3} vAlign="center" wrap="wrap">
            <TextInput
              label="Search"
              isLabelHidden
              placeholder="Search by title or #…"
              value={search}
              onChange={setSearch}
              size="sm"
            />
            <Selector
              label="Priority"
              isLabelHidden
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'all', label: 'All Priorities' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Selector
              label="Assignee"
              isLabelHidden
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={[
                { value: 'all', label: 'All Assignees' },
                { value: 'unassigned', label: 'Unassigned' },
                ...users.map((u) => ({ value: String(u.id), label: u.username })),
              ]}
            />
          </HStack>
        </VStack>
      </LayoutHeader>

      {/* Board Columns */}
      <LayoutContent padding={4}>
        <HStack gap={4} vAlign="stretch" style={{ height: '100%', overflowX: 'auto', minHeight: 'calc(100vh - 180px)' }}>
          {COLUMNS.map((col) => {
            const colTickets = ticketsByColumn[col.id] || [];
            const isTarget = isDraggingOver === col.id;

            return (
              <Card
                key={col.id}
                variant="muted"
                padding={0}
                style={{
                  width: 320,
                  minWidth: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: isTarget ? 'var(--color-overlay-hover)' : undefined,
                  transition: 'background-color 150ms ease',
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isDraggingOver !== col.id) setIsDraggingOver(col.id);
                }}
                onDragLeave={() => setIsDraggingOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(null);
                  const ticketId = e.dataTransfer.getData('text/plain');
                  if (ticketId) {
                    moveTicket(ticketId, col.id);
                  }
                }}
              >
                {/* Column Header */}
                <LayoutHeader hasDivider padding={3}>
                  <HStack hAlign="between" vAlign="center">
                    <HStack gap={2} vAlign="center">
                      <StatusDot variant={col.variant} label={col.title} />
                      <Heading level={4}>{col.title}</Heading>
                    </HStack>
                    <Badge label={colTickets.length} variant="neutral" />
                  </HStack>
                </LayoutHeader>

                {/* Column Tickets List */}
                <LayoutContent padding={2} style={{ overflowY: 'auto', flex: 1 }}>
                  {colTickets.length === 0 ? (
                    <EmptyState
                      isCompact
                      title={col.emptyTitle}
                      description={col.emptyDescription}
                    />
                  ) : (
                    <VStack gap={2}>
                      {colTickets.map((ticket) => {
                        const priorityInfo = PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.low;
                        const otherCols = COLUMNS.filter((c) => c.id !== col.id);

                        return (
                          <Card
                            key={ticket.id}
                            padding={3}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', ticket.id);
                            }}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            style={{
                              cursor: 'pointer',
                              boxShadow: 'var(--shadow-low)',
                              backgroundColor: 'var(--color-background-surface)',
                            }}
                          >
                            <VStack gap={2}>
                              <HStack hAlign="between" vAlign="start">
                                <HStack gap={1} vAlign="center" wrap="wrap">
                                  <Badge label={`#${ticket.number}`} variant="neutral" />
                                  <Badge label={priorityInfo.label} variant={priorityInfo.variant} />
                                  {ticket.points != null && (
                                    <Badge label={`${ticket.points} pt`} variant="neutral" />
                                  )}
                                </HStack>

                                <div onClick={(e) => e.stopPropagation()}>
                                  <MoreMenu
                                    label="Ticket options"
                                    size="sm"
                                    items={[
                                      {
                                        label: 'View details',
                                        onClick: () => setSelectedTicketId(ticket.id),
                                      },
                                      { type: 'divider' },
                                      ...otherCols.map((targetCol) => ({
                                        label: `Move to ${targetCol.title}`,
                                        onClick: () => moveTicket(ticket.id, targetCol.id),
                                      })),
                                    ]}
                                  />
                                </div>
                              </HStack>

                              <Heading level={4}>{ticket.title}</Heading>

                              {ticket.description && (
                                <Text type="supporting" color="secondary" maxLines={2}>
                                  {ticket.description}
                                </Text>
                              )}

                              <HStack hAlign="between" vAlign="center">
                                <Text type="supporting" color="secondary" size="sm">
                                  {ticket.assignee_username ? `@${ticket.assignee_username}` : 'Unassigned'}
                                </Text>
                                {ticket.due_date && (
                                  <Text type="supporting" color="secondary" size="sm">
                                    Due {ticket.due_date}
                                  </Text>
                                )}
                              </HStack>
                            </VStack>
                          </Card>
                        );
                      })}
                    </VStack>
                  )}
                </LayoutContent>
              </Card>
            );
          })}
        </HStack>
      </LayoutContent>

      {/* Ticket Detail Dialog */}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={fetchTickets}
          currentUser={currentUser}
        />
      )}

      {/* Create Ticket Dialog */}
      {isCreateOpen && (
        <CreateTicketForm
          sprintId={sprintId}
          onClose={() => setIsCreateOpen(false)}
          onTicketCreated={() => {
            setIsCreateOpen(false);
            fetchTickets();
          }}
        />
      )}
    </Layout>
  );
}
