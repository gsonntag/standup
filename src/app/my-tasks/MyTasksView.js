'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BellIcon, CheckCircleIcon, EyeIcon, ListChecksIcon, WarningCircleIcon } from '@phosphor-icons/react';
import TicketDetail from '@/components/TicketDetail';
import AppPageHeader from '@/components/AppPageHeader';

function TaskTable({ tickets, empty, dateLabel, dateRenderer, onSelect }) {
  if (tickets.length === 0) {
    return <div className="my-tasks-empty">{empty}</div>;
  }

  return (
    <div className="table-container my-tasks-table-container">
      <Table className="backlog-table my-tasks-table">
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: 92 }}>Issue</TableHead>
            <TableHead>Title</TableHead>
            <TableHead style={{ width: 140 }}>Status</TableHead>
            <TableHead style={{ width: 150 }}>{dateLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-mono text-muted">#{t.number}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="sm" className="backlog-title-button my-task-title-button" onClick={() => onSelect(t.id)}>
                  {t.title}
                </Button>
              </TableCell>
              <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
              <TableCell className="text-muted">{dateRenderer(t)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MentionList({ mentions, onSelect }) {
  if (mentions.length === 0) return <div className="my-tasks-empty">No mentions.</div>;

  return (
    <div className="my-task-list">
      {mentions.map((m) => (
        <button key={m.mention_id} type="button" className="my-task-list-item" onClick={() => onSelect(m.ticket_id)}>
          <span className="my-task-list-icon"><BellIcon weight="bold" /></span>
          <span className="my-task-list-main">
            <strong>#{m.ticket_number} {m.ticket_title}</strong>
            <span>{timeAgo(m.created_at)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BlockerList({ tickets, onSelect }) {
  if (tickets.length === 0) return <div className="my-tasks-empty">No recently unblocked tickets.</div>;

  return (
    <div className="my-task-list">
      {tickets.map((t) => (
        <button key={t.id} type="button" className="my-task-list-item" onClick={() => onSelect(t.id)}>
          <span className="my-task-list-icon my-task-list-icon-success"><CheckCircleIcon weight="bold" /></span>
          <span className="my-task-list-main">
            <strong>#{t.number} {t.title}</strong>
            <span>{t.status}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function MyTasksView({ currentUser }) {
  const [data, setData] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  async function fetchData() {
    const res = await apiFetch('/api/me/tasks');
    const d = await res.json();
    setData(d);
  }

  useEffect(() => { fetchData(); }, []);

  if (!data) return <div className="page"><div className="empty">Loading…</div></div>;

  const summary = [
    { label: 'Assigned', value: data.assigned.length, icon: ListChecksIcon },
    { label: 'Mentions', value: data.mentions.length, icon: BellIcon },
    { label: 'Watching', value: data.watching.length, icon: EyeIcon },
    { label: 'Unblocked', value: data.blockers_cleared.length, icon: WarningCircleIcon },
  ];

  return (
    <div className="page my-tasks-page">
      <AppPageHeader
        icon={ListChecksIcon}
        eyebrow="Inbox"
        title="My Tasks"
        subtitle="Your assigned work, mentions, watched issues, and recently cleared blockers."
      />

      <div className="my-tasks-summary-grid">
        {summary.map((item) => (
          <Card key={item.label} className="my-task-summary-card">
            <CardContent>
              <span className="my-task-summary-icon"><item.icon weight="bold" /></span>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="assigned" className="my-tasks-tabs">
        <TabsList className="my-tasks-tabs-list">
          <TabsTrigger value="assigned"><ListChecksIcon weight="bold" />Assigned</TabsTrigger>
          <TabsTrigger value="mentions"><BellIcon weight="bold" />Mentions</TabsTrigger>
          <TabsTrigger value="watching"><EyeIcon weight="bold" />Watching</TabsTrigger>
          <TabsTrigger value="blockers"><WarningCircleIcon weight="bold" />Unblocked</TabsTrigger>
        </TabsList>

        <Card className="my-tasks-panel">
          <CardHeader>
            <CardTitle>Task inbox</CardTitle>
          </CardHeader>
          <CardContent>
            <TabsContent value="assigned">
              <TaskTable
                tickets={data.assigned}
                empty="Nothing assigned to you."
                dateLabel="Due"
                dateRenderer={(ticket) => ticket.due_date || '-'}
                onSelect={setSelectedTicketId}
              />
            </TabsContent>
            <TabsContent value="mentions">
              <MentionList mentions={data.mentions} onSelect={setSelectedTicketId} />
            </TabsContent>
            <TabsContent value="watching">
              <TaskTable
                tickets={data.watching}
                empty="No recent activity on watched tickets."
                dateLabel="Updated"
                dateRenderer={(ticket) => timeAgo(ticket.updated_at)}
                onSelect={setSelectedTicketId}
              />
            </TabsContent>
            <TabsContent value="blockers">
              <BlockerList tickets={data.blockers_cleared} onSelect={setSelectedTicketId} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => { setSelectedTicketId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
