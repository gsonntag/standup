'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BellIcon, CheckCircleIcon, EyeIcon, ListChecksIcon, WarningCircleIcon } from '@phosphor-icons/react';
import TicketDetail from '@/components/TicketDetail';
import AppPageHeader from '@/components/AppPageHeader';

function TaskTable({ tickets, empty, dateLabel, dateRenderer, onSelect }) {
  if (tickets.length === 0) {
    return <div className="my-tasks-empty">{empty}</div>;
  }

  return (
    <div className="table-container">
      <Table className="backlog-table flat-data-table">
        <TableHeader>
          <TableRow className="ticket-table-head-row">
            <TableHead className="ticket-col-head ticket-col-static ticket-issue-col">Tickets</TableHead>
            <TableHead className="ticket-col-head ticket-col-static" style={{ width: 130 }}>Status</TableHead>
            <TableHead className="ticket-col-head ticket-col-static" style={{ width: 140 }}>{dateLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id} className="ticket-row" onClick={() => onSelect(t.id)}>
              <TableCell className="ticket-issue-cell">
                <div className="ticket-issue-inner">
                  <span className="ticket-id">#{t.number}</span>
                  <span className="ticket-title-text">{t.title}</span>
                </div>
              </TableCell>
              <TableCell className="ticket-priority-cell">
                <Badge className={`status-badge status-badge-${t.status}`} variant="outline">{t.status.replaceAll('_', ' ')}</Badge>
              </TableCell>
              <TableCell className="ticket-assignee-cell text-muted">{dateRenderer(t)}</TableCell>
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
    <div className="my-task-list flat-ticket-list">
      {mentions.map((m) => (
        <button key={m.mention_id} type="button" className="my-task-list-item ticket-row-flat" onClick={() => onSelect(m.ticket_id)}>
          <span className="my-task-list-icon"><BellIcon weight="bold" /></span>
          <div className="ticket-issue-inner">
            <span className="ticket-id">#{m.ticket_number}</span>
            <span className="ticket-title-text">{m.ticket_title}</span>
          </div>
          <span className="dashboard-ticket-meta">{timeAgo(m.created_at)}</span>
        </button>
      ))}
    </div>
  );
}

function BlockerList({ tickets, onSelect }) {
  if (tickets.length === 0) return <div className="my-tasks-empty">No recently unblocked tickets.</div>;

  return (
    <div className="my-task-list flat-ticket-list">
      {tickets.map((t) => (
        <button key={t.id} type="button" className="my-task-list-item ticket-row-flat" onClick={() => onSelect(t.id)}>
          <span className="my-task-list-icon my-task-list-icon-success"><CheckCircleIcon weight="bold" /></span>
          <div className="ticket-issue-inner">
            <span className="ticket-id">#{t.number}</span>
            <span className="ticket-title-text">{t.title}</span>
          </div>
          <Badge className={`status-badge status-badge-${t.status}`} variant="outline">{t.status.replaceAll('_', ' ')}</Badge>
        </button>
      ))}
    </div>
  );
}

const MY_TASK_TABS = [
  { key: 'assigned', label: 'Assigned', icon: ListChecksIcon },
  { key: 'mentions', label: 'Mentions', icon: BellIcon },
  { key: 'watching', label: 'Watching', icon: EyeIcon },
  { key: 'blockers', label: 'Unblocked', icon: WarningCircleIcon },
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
          <Card key={item.label} className="my-task-summary-card ds-card">
            <CardContent>
              <span className="my-task-summary-icon"><item.icon weight="bold" /></span>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="my-tasks-tabbar">
        <nav className="dashboard-topnav-tabs" role="tablist" aria-label="Task inbox">
          {MY_TASK_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`dashboard-topnav-tab${activeTab === key ? ' active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon weight="bold" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="my-tasks-content">
        {activeTab === 'assigned' && (
          <TaskTable
            tickets={data.assigned}
            empty="Nothing assigned to you."
            dateLabel="Due"
            dateRenderer={(ticket) => ticket.due_date || '—'}
            onSelect={setSelectedTicketId}
          />
        )}
        {activeTab === 'mentions' && (
          <MentionList mentions={data.mentions} onSelect={setSelectedTicketId} />
        )}
        {activeTab === 'watching' && (
          <TaskTable
            tickets={data.watching}
            empty="No recent activity on watched tickets."
            dateLabel="Updated"
            dateRenderer={(ticket) => timeAgo(ticket.updated_at)}
            onSelect={setSelectedTicketId}
          />
        )}
        {activeTab === 'blockers' && (
          <BlockerList tickets={data.blockers_cleared} onSelect={setSelectedTicketId} />
        )}
      </div>

      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => { setSelectedTicketId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
