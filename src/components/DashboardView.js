'use client';

import { useState, useEffect } from 'react';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Selector } from '@astryxdesign/core/Selector';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import { Avatar } from '@astryxdesign/core/Avatar';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import TicketDetail from './TicketDetail';

function statusVariant(status) {
  switch (status) {
    case 'active': return 'accent';
    case 'completed': return 'success';
    case 'planning': return 'warning';
    default: return 'neutral';
  }
}

function ticketStatusVariant(status) {
  switch (status) {
    case 'done': return 'success';
    case 'in_progress': return 'accent';
    case 'in_review': return 'neutral';
    case 'todo': return 'warning';
    default: return 'neutral';
  }
}

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard(sprintId) {
    setIsLoading(true);
    const query = sprintId ? `?sprint_id=${sprintId}` : '';
    try {
      const res = await apiFetch(`/api/dashboard${query}`);
      const json = await res.json();
      setData(json);
      if (json.sprint && !sprintId) {
        setSelectedSprintId(json.sprint.id);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(selectedSprintId);
  }, [selectedSprintId]);

  const sprints = data?.sprints || [];
  const currentSprint = data?.sprint;
  const summary = data?.summary || {};
  const inProgressTickets = data?.in_progress_tickets || [];
  const blockedTickets = data?.blocked_tickets || [];
  const dueSoonTickets = data?.due_soon_tickets || [];
  const unassignedTickets = data?.unassigned_tickets || [];
  const members = data?.members || [];
  const recentActivity = data?.recent_activity || [];

  const sprintOptions = sprints.map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.status})`,
  }));

  const totalTickets = summary.total_tickets || 0;
  const doneTickets = summary.done || 0;
  const progressPercent = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0;

  const workloadColumns = [
    {
      key: 'username',
      header: 'Team Member',
      width: proportional(2),
      renderCell: (item) => (
        <HStack gap={2} vAlign="center">
          <Avatar name={item.username} size="sm" />
          <Text weight="semibold">@{item.username}</Text>
        </HStack>
      ),
    },
    {
      key: 'in_progress_count',
      header: 'In Progress',
      width: proportional(1),
      renderCell: (item) => (
        <Badge variant={item.in_progress_count > 0 ? 'accent' : 'neutral'}>
          {item.in_progress_count || 0}
        </Badge>
      ),
    },
    {
      key: 'done_count',
      header: 'Done',
      width: proportional(1),
      renderCell: (item) => (
        <Badge variant={item.done_count > 0 ? 'success' : 'neutral'}>
          {item.done_count || 0}
        </Badge>
      ),
    },
    {
      key: 'total_count',
      header: 'Total Assigned',
      width: proportional(1),
      renderCell: (item) => (
        <Text size="sm">{item.total_count || 0}</Text>
      ),
    },
    {
      key: 'total_points',
      header: 'Story Points',
      width: proportional(1),
      renderCell: (item) => (
        <Text size="sm" weight="medium">
          {item.total_points || 0} pts
        </Text>
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader>
          <HStack gap={4} vAlign="center" justify="space-between" wrap="wrap">
            <VStack gap={1}>
              <Heading level={1}>Operations Dashboard</Heading>
              <Text color="secondary" size="sm">
                Real-time sprint health, team velocity, delivery scope, and workload
              </Text>
            </VStack>

            {sprintOptions.length > 0 && (
              <Selector
                label="Selected Sprint"
                isLabelHidden
                value={selectedSprintId || (currentSprint ? String(currentSprint.id) : '')}
                onChange={setSelectedSprintId}
                options={sprintOptions}
              />
            )}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {isLoading && !data ? (
            <VStack p={8} hAlign="center">
              <Text color="secondary">Loading dashboard analytics…</Text>
            </VStack>
          ) : !currentSprint ? (
            <EmptyState
              title="No active sprint"
              description="Start a sprint from the Sprints page to see real-time delivery telemetry."
            />
          ) : (
            <VStack gap={6}>
              {/* Top KPI Metrics Row */}
              <HStack gap={4} wrap="wrap">
                <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 200 }}>
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center" justify="space-between">
                      <Text size="xs" weight="bold" color="secondary">SPRINT PROGRESS</Text>
                      <Badge variant={statusVariant(currentSprint.status)}>
                        {currentSprint.status.toUpperCase()}
                      </Badge>
                    </HStack>
                    <Heading level={2} style={{ margin: 0 }}>
                      {progressPercent}%
                    </Heading>
                    <ProgressBar
                      label="Sprint completion progress"
                      isLabelHidden
                      value={progressPercent}
                      max={100}
                      variant="accent"
                    />
                    <Text size="xs" color="secondary">
                      {doneTickets} of {totalTickets} tickets resolved
                    </Text>
                  </VStack>
                </Card>

                <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 200 }}>
                  <VStack gap={2}>
                    <Text size="xs" weight="bold" color="secondary">IN PROGRESS</Text>
                    <Heading level={2} style={{ margin: 0 }}>
                      {summary.in_progress || 0}
                    </Heading>
                    <HStack gap={1} vAlign="center">
                      <StatusDot variant="accent" />
                      <Text size="xs" color="secondary">Currently in development</Text>
                    </HStack>
                  </VStack>
                </Card>

                <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 200 }}>
                  <VStack gap={2}>
                    <Text size="xs" weight="bold" color="secondary">BLOCKED TICKETS</Text>
                    <Heading level={2} style={{ margin: 0 }}>
                      {blockedTickets.length}
                    </Heading>
                    <HStack gap={1} vAlign="center">
                      <StatusDot variant={blockedTickets.length > 0 ? 'error' : 'success'} />
                      <Text size="xs" color="secondary">Unresolved blockers</Text>
                    </HStack>
                  </VStack>
                </Card>

                <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 200 }}>
                  <VStack gap={2}>
                    <Text size="xs" weight="bold" color="secondary">OVERDUE / DUE SOON</Text>
                    <Heading level={2} style={{ margin: 0 }}>
                      {(summary.overdue || 0) + (summary.due_soon || 0)}
                    </Heading>
                    <HStack gap={1} vAlign="center">
                      <StatusDot variant={summary.overdue > 0 ? 'warning' : 'neutral'} />
                      <Text size="xs" color="secondary">{summary.overdue || 0} overdue</Text>
                    </HStack>
                  </VStack>
                </Card>
              </HStack>

              {/* Navigation Tabs */}
              <TabList value={activeTab} onChange={setActiveTab} size="md">
                <Tab value="overview" label="Scope Overview" />
                <Tab value="workload" label={`Team Workload (${members.length})`} />
                <Tab value="activity" label={`Recent Activity (${recentActivity.length})`} />
              </TabList>

              {/* Tab 1: Scope Overview */}
              {activeTab === 'overview' && (
                <HStack gap={6} align="start" wrap="wrap">
                  {/* Left Column: In Progress & Due Soon */}
                  <VStack gap={6} style={{ flex: 1, minWidth: 320 }}>
                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <HStack gap={2} vAlign="center" justify="space-between">
                          <Heading level={3} style={{ margin: 0 }}>In Progress Work</Heading>
                          <Badge variant="accent">{inProgressTickets.length}</Badge>
                        </HStack>
                        {inProgressTickets.length === 0 ? (
                          <Text size="sm" color="secondary">No tickets currently in progress.</Text>
                        ) : (
                          <VStack gap={2}>
                            {inProgressTickets.map((t) => (
                              <Card
                                key={t.id}
                                p={3}
                                variant="standard"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedTicketId(t.id)}
                              >
                                <HStack gap={2} vAlign="center" justify="space-between">
                                  <HStack gap={2} vAlign="center">
                                    <Badge variant="accent">#{t.number}</Badge>
                                    <Text size="sm" weight="medium">{t.title}</Text>
                                  </HStack>
                                  <Text size="xs" color="secondary">
                                    {t.assignee_username ? `@${t.assignee_username}` : 'Unassigned'}
                                  </Text>
                                </HStack>
                              </Card>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Card>

                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <HStack gap={2} vAlign="center" justify="space-between">
                          <Heading level={3} style={{ margin: 0 }}>Due Soon / Overdue</Heading>
                          <Badge variant="warning">{dueSoonTickets.length}</Badge>
                        </HStack>
                        {dueSoonTickets.length === 0 ? (
                          <Text size="sm" color="secondary">No upcoming due date bottlenecks.</Text>
                        ) : (
                          <VStack gap={2}>
                            {dueSoonTickets.map((t) => (
                              <Card
                                key={t.id}
                                p={3}
                                variant="standard"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedTicketId(t.id)}
                              >
                                <HStack gap={2} vAlign="center" justify="space-between">
                                  <HStack gap={2} vAlign="center">
                                    <Badge variant="warning">#{t.number}</Badge>
                                    <Text size="sm" weight="medium">{t.title}</Text>
                                  </HStack>
                                  <Text size="xs" color="secondary">
                                    Due {t.due_date?.split('T')[0]}
                                  </Text>
                                </HStack>
                              </Card>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Card>
                  </VStack>

                  {/* Right Column: Blocked & Unassigned */}
                  <VStack gap={6} style={{ flex: 1, minWidth: 320 }}>
                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <HStack gap={2} vAlign="center" justify="space-between">
                          <Heading level={3} style={{ margin: 0 }}>Blocked Tickets</Heading>
                          <Badge variant="error">{blockedTickets.length}</Badge>
                        </HStack>
                        {blockedTickets.length === 0 ? (
                          <Text size="sm" color="secondary">All tickets unblocked and clear.</Text>
                        ) : (
                          <VStack gap={2}>
                            {blockedTickets.map((t) => (
                              <Card
                                key={t.id}
                                p={3}
                                variant="standard"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedTicketId(t.id)}
                              >
                                <HStack gap={2} vAlign="center" justify="space-between">
                                  <HStack gap={2} vAlign="center">
                                    <Badge variant="error">#{t.number}</Badge>
                                    <Text size="sm" weight="medium">{t.title}</Text>
                                  </HStack>
                                  <Badge variant="error">Blocked</Badge>
                                </HStack>
                              </Card>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Card>

                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <HStack gap={2} vAlign="center" justify="space-between">
                          <Heading level={3} style={{ margin: 0 }}>Unassigned Scope</Heading>
                          <Badge variant="neutral">{unassignedTickets.length}</Badge>
                        </HStack>
                        {unassignedTickets.length === 0 ? (
                          <Text size="sm" color="secondary">All tickets assigned to team members.</Text>
                        ) : (
                          <VStack gap={2}>
                            {unassignedTickets.map((t) => (
                              <Card
                                key={t.id}
                                p={3}
                                variant="standard"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedTicketId(t.id)}
                              >
                                <HStack gap={2} vAlign="center" justify="space-between">
                                  <HStack gap={2} vAlign="center">
                                    <Badge variant="neutral">#{t.number}</Badge>
                                    <Text size="sm" weight="medium">{t.title}</Text>
                                  </HStack>
                                  <Badge variant={ticketStatusVariant(t.status)}>
                                    {t.status}
                                  </Badge>
                                </HStack>
                              </Card>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Card>
                  </VStack>
                </HStack>
              )}

              {/* Tab 2: Team Workload */}
              {activeTab === 'workload' && (
                <Card p={0} variant="subtle">
                  <Table
                    data={members}
                    columns={workloadColumns}
                    idKey="username"
                    hasHover
                  />
                </Card>
              )}

              {/* Tab 3: Recent Activity */}
              {activeTab === 'activity' && (
                <Card p={4} variant="subtle">
                  <VStack gap={3}>
                    {recentActivity.length === 0 ? (
                      <Text size="sm" color="secondary">No recent events in this sprint.</Text>
                    ) : (
                      recentActivity.map((evt, idx) => (
                        <HStack key={idx} gap={3} vAlign="center">
                          <StatusDot variant="neutral" />
                          <Text size="sm">
                            <strong>@{evt.actor_username || 'System'}</strong>{' '}
                            {evt.action || 'updated ticket'} #{evt.ticket_number || ''}
                          </Text>
                          <Text size="xs" color="secondary">
                            {timeAgo(evt.created_at)}
                          </Text>
                        </HStack>
                      ))
                    )}
                  </VStack>
                </Card>
              )}
            </VStack>
          )}
        </LayoutContent>
      }
    >
      {/* Ticket Detail Inspection Dialog */}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
    </Layout>
  );
}
