'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
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
import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import TicketDetail from '@/components/TicketDetail';

const STATUS_VARIANTS = {
  todo: { variant: 'warning', label: 'To Do' },
  in_progress: { variant: 'accent', label: 'In Progress' },
  in_review: { variant: 'warning', label: 'In Review' },
  done: { variant: 'success', label: 'Done' },
  backlog: { variant: 'neutral', label: 'Backlog' },
};

const MY_TASK_TABS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'watching', label: 'Watching' },
  { key: 'blockers', label: 'Unblocked' },
];

export default function MyTasksView({ currentUser }) {
  const [data, setData] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeTab, setActiveTab] = useState('assigned');

  async function fetchData() {
    const res = await apiFetch('/api/me/tasks');
    const d = await res.json();
    setData(d);
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (!data) {
    return (
      <Layout height="fill" contentWidth="fill">
        <LayoutContent padding={4}>
          <Text type="body" color="secondary">Loading tasks…</Text>
        </LayoutContent>
      </Layout>
    );
  }

  const summary = [
    { label: 'Assigned', value: data.assigned.length, key: 'assigned' },
    { label: 'Mentions', value: data.mentions.length, key: 'mentions' },
    { label: 'Watching', value: data.watching.length, key: 'watching' },
    { label: 'Unblocked', value: data.blockers_cleared.length, key: 'blockers' },
  ];

  const columns = [
    {
      key: 'number',
      header: 'ID',
      width: pixel(75),
      renderCell: (t) => (
        <Text type="body" weight="bold" color="secondary" size="sm">
          #{t.number}
        </Text>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      width: proportional(2),
      renderCell: (t) => (
        <Text type="body" weight="medium" size="sm">
          {t.title}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(130),
      renderCell: (t) => {
        const st = STATUS_VARIANTS[t.status] || { variant: 'neutral', label: t.status };
        return <StatusDot variant={st.variant} label={st.label} />;
      },
    },
    {
      key: 'due_date',
      header: 'Due / Updated',
      width: pixel(140),
      renderCell: (t) => (
        <Text type="body" color="secondary" size="sm">
          {t.due_date ? `Due ${t.due_date}` : timeAgo(t.updated_at)}
        </Text>
      ),
    },
  ];

  return (
    <Layout height="fill" contentWidth="fill">
      {/* Header */}
      <LayoutHeader hasDivider padding={4}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>My Tasks</Heading>
            <Text type="body" color="secondary" size="sm">
              Your assigned work, mentions, watched issues, and recently cleared blockers.
            </Text>
          </VStack>

          {/* KPI Summary Cards */}
          <HStack gap={3} wrap="wrap">
            {summary.map((item) => (
              <Card
                key={item.label}
                padding={3}
                style={{
                  minWidth: 140,
                  cursor: 'pointer',
                  backgroundColor: activeTab === item.key ? 'var(--color-overlay-hover)' : 'var(--color-background-surface)',
                  border: activeTab === item.key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                }}
                onClick={() => setActiveTab(item.key)}
              >
                <VStack gap={1}>
                  <Text type="supporting" color="secondary" size="xs">
                    {item.label}
                  </Text>
                  <Text type="body" weight="bold" size="xl" hasTabularNumbers>
                    {item.value}
                  </Text>
                </VStack>
              </Card>
            ))}
          </HStack>

          {/* Tab Filter Buttons */}
          <HStack gap={2}>
            {MY_TASK_TABS.map(({ key, label }) => (
              <Button
                key={key}
                variant={activeTab === key ? 'primary' : 'secondary'}
                size="sm"
                label={label}
                onClick={() => setActiveTab(key)}
              />
            ))}
          </HStack>
        </VStack>
      </LayoutHeader>

      {/* Content */}
      <LayoutContent padding={4}>
        {activeTab === 'assigned' && (
          data.assigned.length === 0 ? (
            <EmptyState title="Nothing assigned" description="You have no tickets currently assigned to you." />
          ) : (
            <div style={{ backgroundColor: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <Table
                data={data.assigned}
                columns={columns}
                density="standard"
                onRowClick={(row) => setSelectedTicketId(row.id)}
              />
            </div>
          )
        )}

        {activeTab === 'mentions' && (
          data.mentions.length === 0 ? (
            <EmptyState title="No mentions" description="You have no unread mentions or notifications." />
          ) : (
            <div style={{ backgroundColor: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <Table
                data={data.mentions.map((m) => ({
                  id: m.ticket_id,
                  number: m.ticket_number,
                  title: m.ticket_title,
                  status: 'in_progress',
                  updated_at: m.created_at,
                }))}
                columns={columns}
                density="standard"
                onRowClick={(row) => setSelectedTicketId(row.id)}
              />
            </div>
          )
        )}

        {activeTab === 'watching' && (
          data.watching.length === 0 ? (
            <EmptyState title="No watched tickets" description="Tickets you are watching will appear here." />
          ) : (
            <div style={{ backgroundColor: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <Table
                data={data.watching}
                columns={columns}
                density="standard"
                onRowClick={(row) => setSelectedTicketId(row.id)}
              />
            </div>
          )
        )}

        {activeTab === 'blockers' && (
          data.blockers_cleared.length === 0 ? (
            <EmptyState title="No cleared blockers" description="Tickets with recently cleared blockers will appear here." />
          ) : (
            <div style={{ backgroundColor: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <Table
                data={data.blockers_cleared}
                columns={columns}
                density="standard"
                onRowClick={(row) => setSelectedTicketId(row.id)}
              />
            </div>
          )
        )}
      </LayoutContent>

      {/* Ticket Detail Dialog */}
      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => {
            setSelectedTicketId(null);
            fetchData();
          }}
          currentUser={currentUser}
        />
      )}
    </Layout>
  );
}
