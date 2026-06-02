'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChartBarIcon,
  CheckCircleIcon,
  GitPullRequestIcon,
  LightningIcon,
  TargetIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import AppPageHeader from './AppPageHeader';

export default function DashboardView() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [sprint, setSprint] = useState(null);
  const [members, setMembers] = useState([]);
  const [inProgressTickets, setInProgressTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/dashboard').then((r) => r.json()).then((d) => {
      const list = d.sprints || [];
      setSprints(list);
      setSprint(d.sprint || null);
      setMembers(d.members || []);
      setInProgressTickets(d.in_progress_tickets || []);
      setSprintId(d.sprint?.id || '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    const query = sprintId ? `?sprint_id=${sprintId}` : '';
    apiFetch(`/api/dashboard${query}`).then((r) => r.json()).then((d) => {
      setSprint(d.sprint || null);
      setSprints(d.sprints || []);
      setMembers(d.members || []);
      setInProgressTickets(d.in_progress_tickets || []);
      setLoading(false);
    });
  }, [sprintId]);

  const totals = members.reduce((acc, m) => ({
    done: acc.done + m.done,
    in_progress: acc.in_progress + m.in_progress,
    in_review: acc.in_review + m.in_review,
    points_done: acc.points_done + m.points_done,
    total_points: acc.total_points + m.total_points,
  }), { done: 0, in_progress: 0, in_review: 0, points_done: 0, total_points: 0 });
  const completion = totals.total_points > 0 ? Math.round((totals.points_done / totals.total_points) * 100) : 0;
  const summaryCards = [
    { label: 'Prod', value: totals.done, icon: CheckCircleIcon, tone: 'green' },
    { label: 'In progress', value: totals.in_progress, icon: LightningIcon, tone: 'blue' },
    { label: 'PR', value: totals.in_review, icon: GitPullRequestIcon, tone: 'yellow' },
    { label: 'Completion', value: `${completion}%`, icon: TargetIcon, tone: 'neutral' },
  ];

  return (
    <div className="page">
      <AppPageHeader
        icon={ChartBarIcon}
        eyebrow="Operations"
        title="Dashboard"
        subtitle="Sprint health and team delivery for LA Hacks engineering."
        actions={(
          <Select value={sprintId || 'none'} onValueChange={(value) => setSprintId(value === 'none' ? '' : value)}>
            <SelectTrigger className="dashboard-sprint-select">
              <SelectValue placeholder="Select sprint" />
            </SelectTrigger>
            <SelectContent>
              {!sprints.length && <SelectItem value="none">No sprints</SelectItem>}
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.status === 'active' ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      {!sprintId && !loading && (
        <Card className="dashboard-empty-card">
          <CardContent>No sprints yet. Create one on the Sprints page.</CardContent>
        </Card>
      )}

      {sprintId && (
        <>
          {sprint && (
            <div className="dashboard-sprint-meta">
              <Badge variant={sprint.status === 'active' ? 'default' : 'outline'}>{sprint.status}</Badge>
              <span>{sprint.start_date} - {sprint.end_date}</span>
            </div>
          )}
          <div className="dashboard-summary-grid">
            {summaryCards.map(({ label, value, icon: Icon, tone }) => (
              <Card className="dashboard-summary-card ds-card" data-tone={tone} key={label}>
                <CardHeader>
                  <span className="ds-stat-icon"><Icon weight="bold" /></span>
                  <CardTitle>{label}</CardTitle>
                </CardHeader>
                <CardContent>{value}</CardContent>
              </Card>
            ))}
          </div>
          <Card className="dashboard-table-card ds-card">
            <CardHeader>
              <span className="ds-section-icon"><UsersThreeIcon weight="bold" /></span>
              <CardTitle>Team workload</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="dashboard-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Prod</TableHead>
                    <TableHead>In Progress</TableHead>
                    <TableHead>PR</TableHead>
                    <TableHead>Points Done</TableHead>
                    <TableHead>Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold">
                      <span className="ds-person-cell"><span className="ds-avatar">{m.username.slice(0, 2)}</span>{m.username}</span>
                    </TableCell>
                    <TableCell>{m.done}</TableCell>
                    <TableCell>{m.in_progress}</TableCell>
                    <TableCell>{m.in_review}</TableCell>
                    <TableCell>{m.points_done}</TableCell>
                    <TableCell className="text-muted">{m.total_points}</TableCell>
                  </TableRow>
                ))}
                {!members.length && !loading && (
                  <TableRow><TableCell colSpan={6}><div className="empty">No members</div></TableCell></TableRow>
                )}
                </TableBody>
              {members.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="font-bold">{totals.done}</TableCell>
                    <TableCell className="font-bold">{totals.in_progress}</TableCell>
                    <TableCell className="font-bold">{totals.in_review}</TableCell>
                    <TableCell className="font-bold">{totals.points_done}</TableCell>
                    <TableCell className="font-bold">{totals.total_points}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
              </Table>
            </CardContent>
          </Card>
          <Card className="dashboard-table-card ds-card">
            <CardHeader>
              <span className="ds-section-icon"><LightningIcon weight="bold" /></span>
              <CardTitle>Currently moving</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="dashboard-ticket-list">
                {inProgressTickets.map((ticket) => (
                  <div key={ticket.id} className="dashboard-ticket-row">
                    <span className="text-mono">#{ticket.number}</span>
                    <strong>{ticket.title}</strong>
                    <Badge className={`status-badge status-badge-${ticket.status}`} variant="outline">{ticket.status.replaceAll('_', ' ')}</Badge>
                    <span className="text-muted">
                      {ticket.assignee_names?.length ? ticket.assignee_names.map((name) => `@${name}`).join(', ') : 'Unassigned'}
                    </span>
                  </div>
                ))}
                {!inProgressTickets.length && !loading && (
                  <div className="dashboard-empty-inline">No tickets currently in progress or PR.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
