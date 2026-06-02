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
  ClockIcon,
  FireIcon,
  GitPullRequestIcon,
  LightningIcon,
  PushPinIcon,
  TargetIcon,
  WarningIcon,
  UsersThreeIcon,
  ChatCircleTextIcon,
  GitCommitIcon,
  CalendarBlankIcon,
  UserCircleIcon,
  UsersIcon,
  RocketLaunchIcon,
  ActivityIcon,
} from '@phosphor-icons/react';
import { parseTimestamp, timeAgo } from '@/lib/dates';
import AppPageHeader from './AppPageHeader';
import TicketDetail from './TicketDetail';
import { useRealtime } from '@/lib/realtime';

function formatDashboardDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function assigneeLabel(ticket) {
  return ticket.assignee_names?.length ? ticket.assignee_names.map((name) => `@${name}`).join(', ') : 'Unassigned';
}

function DashboardTicketList({ tickets, emptyText, showDue = false, showBlockers = false, onTicketClick }) {
  if (!tickets.length) return <div className="dashboard-empty-inline">{emptyText}</div>;

  return (
    <div className="dashboard-ticket-list">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="dashboard-ticket-row cursor-pointer transition-colors"
          onClick={() => onTicketClick(ticket.id)}
        >
          <span className="text-mono">#{ticket.number}</span>
          <strong>{ticket.title}</strong>
          <Badge className={`status-badge status-badge-${ticket.status}`} variant="outline">
            {ticket.status.replaceAll('_', ' ')}
          </Badge>
          {showDue && ticket.due_date && <span className="linear-muted-chip">Due {formatDashboardDate(ticket.due_date)}</span>}
          {showBlockers && ticket.unresolved_blocker_count > 0 && (
            <span className="linear-muted-chip text-red-400 border-red-500/20 bg-red-500/5">
              {ticket.unresolved_blocker_count} blocker{ticket.unresolved_blocker_count === 1 ? '' : 's'}
            </span>
          )}
          <span className="text-muted">{assigneeLabel(ticket)}</span>
        </div>
      ))}
    </div>
  );
}

function SprintHealthGauge({ score }) {
  const radius = 46;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = '#27a644';
  if (score < 50) strokeColor = '#c9372c';
  else if (score < 75) strokeColor = '#f5cd47';

  return (
    <div className="health-gauge-container">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="health-gauge-circle-bg"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="health-gauge-circle-progress"
          strokeWidth={strokeWidth}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="health-gauge-value">
        <span>{score}%</span>
        <span className="health-gauge-label">Health</span>
      </div>
    </div>
  );
}

function BurnupChart({ data }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  if (!data || data.length === 0) {
    return <div className="dashboard-empty-inline">No analytical data points available for this sprint duration.</div>;
  }

  const chartWidth = 640;
  const chartHeight = 280;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const N = data.length;
  const maxPoints = Math.max(...data.map((d) => Math.max(d.scope || 0, d.ideal || 0, d.actual || 0)), 10);

  const getX = (index) => {
    if (N <= 1) return paddingLeft;
    return paddingLeft + (index / (N - 1)) * (chartWidth - paddingLeft - paddingRight);
  };

  const getY = (val) => {
    if (val == null) return null;
    return chartHeight - paddingBottom - (val / maxPoints) * (chartHeight - paddingTop - paddingBottom);
  };

  let scopePath = '';
  let idealPath = '';
  let actualPath = '';
  let actualAreaPath = '';

  data.forEach((d, i) => {
    const x = getX(i);
    const yScope = getY(d.scope);
    const yIdeal = getY(d.ideal);
    const yActual = getY(d.actual);

    if (i === 0) {
      scopePath = `M ${x} ${yScope}`;
      idealPath = `M ${x} ${yIdeal}`;
      if (yActual !== null) {
        actualPath = `M ${x} ${yActual}`;
        actualAreaPath = `M ${x} ${getY(0)} L ${x} ${yActual}`;
      }
    } else {
      scopePath += ` L ${x} ${yScope}`;
      idealPath += ` L ${x} ${yIdeal}`;
      if (yActual !== null) {
        if (actualPath === '') {
          actualPath = `M ${x} ${yActual}`;
          actualAreaPath = `M ${x} ${getY(0)} L ${x} ${yActual}`;
        } else {
          actualPath += ` L ${x} ${yActual}`;
          actualAreaPath += ` L ${x} ${yActual}`;
        }
      }
    }
  });

  if (actualAreaPath !== '') {
    const lastIdx = data.findIndex((d) => d.actual === null) - 1;
    const finalIdx = lastIdx >= 0 ? lastIdx : N - 1;
    actualAreaPath += ` L ${getX(finalIdx)} ${getY(0)} Z`;
  }

  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((i / 4) * maxPoints);
    yTicks.push({ val, y: getY(val) });
  }

  const xTicks = [];
  const tickStep = Math.max(1, Math.floor(N / 5));
  for (let i = 0; i < N; i += tickStep) {
    xTicks.push({ label: formatDashboardDate(data[i].date), x: getX(i) });
  }
  if ((N - 1) % tickStep !== 0) {
    xTicks.push({ label: formatDashboardDate(data[N - 1].date), x: getX(N - 1) });
  }

  return (
    <div className="burnup-svg-container select-none">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
        <defs>
          <linearGradient id="burnup-actual-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--linear-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--linear-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={chartWidth - paddingRight}
              y2={tick.y}
              className="chart-grid-line"
            />
            <text
              x={paddingLeft - 8}
              y={tick.y + 3}
              className="chart-text"
              textAnchor="end"
            >
              {tick.val}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map((tick, i) => (
          <g key={i}>
            <text
              x={tick.x}
              y={chartHeight - 12}
              className="chart-text"
              textAnchor="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Scope Line */}
        <path d={scopePath} className="chart-line-scope" />

        {/* Ideal Line */}
        <path d={idealPath} className="chart-line-ideal" />

        {/* Actual Area */}
        {actualAreaPath && <path d={actualAreaPath} className="chart-area-actual" />}

        {/* Actual Line */}
        {actualPath && <path d={actualPath} className="chart-line-actual" />}

        {/* Data points for Actual */}
        {data.map((d, i) => {
          const y = getY(d.actual);
          if (y === null) return null;
          return (
            <circle
              key={i}
              cx={getX(i)}
              cy={y}
              r={hoveredPoint?.index === i ? 6.5 : 4.5}
              className="chart-dot"
              onMouseEnter={() => setHoveredPoint({ ...d, index: i, x: getX(i), y })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          className="chart-tooltip absolute"
          style={{
            left: `${(hoveredPoint.x / chartWidth) * 100}%`,
            top: `${(hoveredPoint.y / chartHeight) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
            zIndex: 10,
          }}
        >
          <div className="font-bold border-b border-white/5 pb-1 mb-1">{formatDashboardDate(hoveredPoint.date)}</div>
          <div className="flex gap-4 justify-between">
            <span className="text-muted">Total Scope:</span>
            <strong>{hoveredPoint.scope} pts</strong>
          </div>
          <div className="flex gap-4 justify-between">
            <span className="text-muted">Ideal Burnup:</span>
            <strong>{hoveredPoint.ideal} pts</strong>
          </div>
          <div className="flex gap-4 justify-between">
            <span className="text-muted text-indigo-300">Actual Done:</span>
            <strong className="text-indigo-400">{hoveredPoint.actual} pts</strong>
          </div>
        </div>
      )}

      <div className="chart-legends">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#c9372c', borderRadius: 0, height: '2px', width: '12px' }} />
          <span>Total Scope ({data[N - 1]?.scope || 0} pts)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ border: '1px dashed rgba(255,255,255,0.4)', background: 'transparent', height: '2px', width: '12px' }} />
          <span>Ideal Path</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: 'var(--linear-primary)', height: '8px', width: '8px', borderRadius: '50%' }} />
          <span>Actual Completed</span>
        </div>
      </div>
    </div>
  );
}

function StatusBreakdown({ summary }) {
  if (!summary) return null;
  const total = summary.total_tickets || 0;
  if (total === 0) return <div className="dashboard-empty-inline">No tickets inside this sprint scope.</div>;

  const pct = (val) => Math.round((val / total) * 100);

  const statuses = [
    { label: 'Backlog', val: summary.backlog, color: '#62666d' },
    { label: 'To do', val: summary.todo, color: 'rgba(255,255,255,0.15)' },
    { label: 'In progress', val: summary.in_progress, color: '#5e6ad2' },
    { label: 'PR', val: summary.in_review, color: '#f5cd47' },
    { label: 'Done', val: summary.done, color: '#27a644' },
  ].filter((s) => s.val > 0);

  return (
    <div className="space-y-4">
      <div className="workload-progress-track" style={{ height: '14px' }}>
        {statuses.map((s, i) => (
          <div
            key={i}
            className="workload-segment"
            style={{
              width: `${(s.val / total) * 100}%`,
              backgroundColor: s.color,
            }}
            title={`${s.label}: ${s.val} ticket${s.val === 1 ? '' : 's'} (${pct(s.val)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-between text-xs pt-1">
        {statuses.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="legend-color" style={{ backgroundColor: s.color, width: '10px', height: '10px' }} />
            <span className="font-bold">{s.val}</span>
            <span className="text-muted">{s.label}</span>
            <span className="text-muted text-[10px]">({pct(s.val)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActivityMessage(item, onTicketClick) {
  const actor = <strong>@{item.actor_username}</strong>;
  const ticketRef = <span className="text-mono text-white/50">#{item.ticket_number}</span>;
  const ticketLink = (
    <strong
      className="text-white hover:underline cursor-pointer"
      onClick={() => onTicketClick(item.ticket_id)}
    >
      {item.ticket_title}
    </strong>
  );

  if (item.kind === 'comment') {
    return (
      <div className="activity-message">
        {actor} commented on {ticketRef} {ticketLink}:
        <div className="activity-comment-block">{item.new_value}</div>
      </div>
    );
  }

  const field = item.field;
  const oldVal = item.old_value;
  const newVal = item.new_value;

  if (field === 'status') {
    const formattedNewVal = newVal ? newVal.replaceAll('_', ' ') : 'none';
    return (
      <div className="activity-message">
        {actor} moved {ticketRef} {ticketLink} to <span className="capitalize">{formattedNewVal}</span>
      </div>
    );
  }

  if (field === 'assignee') {
    if (!newVal) {
      return (
        <div className="activity-message">
          {actor} unassigned {ticketRef} {ticketLink}
        </div>
      );
    }
    return (
      <div className="activity-message">
        {actor} assigned {ticketRef} {ticketLink} to <strong>@{newVal}</strong>
      </div>
    );
  }

  if (field === 'priority') {
    return (
      <div className="activity-message">
        {actor} updated priority of {ticketRef} {ticketLink} to <strong className="capitalize">{newVal}</strong>
      </div>
    );
  }

  if (field === 'sprint') {
    return (
      <div className="activity-message">
        {actor} moved {ticketRef} {ticketLink} to sprint <strong>{newVal || '(none)'}</strong>
      </div>
    );
  }

  const displayOld = oldVal ? `"${oldVal}"` : '(none)';
  const displayNew = newVal ? `"${newVal}"` : '(none)';
  return (
    <div className="activity-message">
      {actor} updated {field} of {ticketRef} {ticketLink} from {displayOld} to {displayNew}
    </div>
  );
}

function getActivityBadgeClassAndIcon(item) {
  if (item.kind === 'comment') {
    return { className: 'comment', Icon: ChatCircleTextIcon };
  }
  if (item.field === 'status') {
    return { className: 'status', Icon: CheckCircleIcon };
  }
  if (item.field === 'priority') {
    return { className: 'priority', Icon: FireIcon };
  }
  if (item.field === 'assignee') {
    return { className: 'assignee', Icon: UserCircleIcon };
  }
  if (item.field === 'sprint') {
    return { className: 'sprint', Icon: CalendarBlankIcon };
  }
  return { className: '', Icon: ActivityIcon };
}

export default function DashboardView() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [sprint, setSprint] = useState(null);
  const [members, setMembers] = useState([]);
  const [inProgressTickets, setInProgressTickets] = useState([]);
  const [blockedTickets, setBlockedTickets] = useState([]);
  const [dueSoonTickets, setDueSoonTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [burnupChart, setBurnupChart] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = () => {
    const query = sprintId ? `?sprint_id=${sprintId}` : '';
    apiFetch(`/api/dashboard${query}`)
      .then((r) => r.json())
      .then((d) => {
        setSprint(d.sprint || null);
        setSprints(d.sprints || []);
        setMembers(d.members || []);
        setInProgressTickets(d.in_progress_tickets || []);
        setBlockedTickets(d.blocked_tickets || []);
        setDueSoonTickets(d.due_soon_tickets || []);
        setUnassignedTickets(d.unassigned_tickets || []);
        setSummary(d.summary || null);
        setBurnupChart(d.burnup_chart || []);
        setRecentActivity(d.recent_activity || []);
        if (d.sprint?.id && !sprintId) {
          setSprintId(d.sprint.id);
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [sprintId]);

  useRealtime((event) => {
    if (['ticket', 'comment', 'sprint'].includes(event.kind)) {
      fetchDashboardData();
    }
  });

  const totals = members.reduce(
    (acc, m) => ({
      done: acc.done + m.done,
      in_progress: acc.in_progress + m.in_progress,
      in_review: acc.in_review + m.in_review,
      points_done: acc.points_done + m.points_done,
      total_points: acc.total_points + m.total_points,
    }),
    { done: 0, in_progress: 0, in_review: 0, points_done: 0, total_points: 0 }
  );

  const completion = totals.total_points > 0 ? Math.round((totals.points_done / totals.total_points) * 100) : 0;

  // Aggregate Sprint Health Score:
  const blockedCount = blockedTickets.length;
  const overdueCount = summary?.overdue || 0;
  const unassignedCount = summary?.unassigned || 0;
  
  let healthScore = Math.max(0, 100 - (100 - completion) * 0.6);
  healthScore -= Math.min(20, blockedCount * 10);
  healthScore -= Math.min(20, overdueCount * 5);
  healthScore -= Math.min(10, unassignedCount * 3);
  healthScore = Math.round(healthScore);

  const summaryCards = [
    { label: 'Prod Done', value: totals.done, icon: CheckCircleIcon, tone: 'green' },
    { label: 'In progress', value: totals.in_progress, icon: LightningIcon, tone: 'blue' },
    { label: 'Code Review', value: totals.in_review, icon: GitPullRequestIcon, tone: 'yellow' },
    { label: 'Points Target', value: `${totals.points_done} / ${totals.total_points}`, icon: TargetIcon, tone: 'neutral' },
  ];

  let timeElapsedPercent = 0;
  let timeText = '';
  if (sprint) {
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const today = new Date();
    const totalDuration = end - start;
    if (totalDuration > 0) {
      const elapsed = today - start;
      timeElapsedPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
      const daysRemaining = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
      timeText = daysRemaining === 0 ? 'Sprint duration ended' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
    }
  }

  return (
    <div className="page">
      <AppPageHeader
        icon={ChartBarIcon}
        eyebrow="Operations"
        title="Dashboard"
        subtitle="Sprint health and team delivery analytics for Standup engineering."
        actions={
          <Select value={sprintId || 'none'} onValueChange={(value) => setSprintId(value === 'none' ? '' : value)}>
            <SelectTrigger className="dashboard-sprint-select">
              <SelectValue placeholder="Select sprint" />
            </SelectTrigger>
            <SelectContent>
              {!sprints.length && <SelectItem value="none">No sprints</SelectItem>}
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.status === 'active' ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {!sprintId && !loading && (
        <Card className="dashboard-empty-card ds-card glass">
          <CardContent>No sprints yet. Create one on the Sprints page.</CardContent>
        </Card>
      )}

      {sprintId && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            {sprint && (
              <div className="dashboard-sprint-meta mb-0 flex-wrap">
                <Badge variant={sprint.status === 'active' ? 'default' : 'outline'}>{sprint.status}</Badge>
                <span>
                  {sprint.start_date} – {sprint.end_date}
                </span>
                {timeText && <span className="linear-muted-chip">{timeText}</span>}
              </div>
            )}

            <div className="dashboard-tabs-container mb-0">
              <button
                className={`dashboard-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`dashboard-tab-btn ${activeTab === 'active_work' ? 'active' : ''}`}
                onClick={() => setActiveTab('active_work')}
              >
                Active Scope
              </button>
              <button
                className={`dashboard-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                Team Workload
              </button>
              <button
                className={`dashboard-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                Analytics
              </button>
              <button
                className={`dashboard-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                Activity Feed
              </button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {sprint && timeText && (
                <Card className="ds-card glass p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1">
                    <span>Sprint Duration Timeline</span>
                    <span>{timeElapsedPercent}% elapsed</span>
                  </div>
                  <div className="sprint-time-progress-bar">
                    <div className="sprint-time-progress-fill" style={{ width: `${timeElapsedPercent}%` }} />
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="ds-card glass lg:col-span-1 flex flex-col justify-center items-center py-6">
                  <SprintHealthGauge score={healthScore} />
                </Card>

                <div className="lg:col-span-3 grid grid-cols-2 gap-4">
                  {summaryCards.map(({ label, value, icon: Icon, tone }) => (
                    <Card className="dashboard-summary-card ds-card glass" data-tone={tone} key={label}>
                      <CardHeader>
                        <span className="ds-stat-icon">
                          <Icon weight="bold" />
                        </span>
                        <CardTitle>{label}</CardTitle>
                      </CardHeader>
                      <CardContent>{value}</CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="ds-card glass">
                  <CardHeader>
                    <span className="ds-section-icon">
                      <TargetIcon weight="bold" />
                    </span>
                    <CardTitle>Sprint Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-3xl font-extrabold text-white">{completion}%</span>
                        <span className="text-xs text-muted block mt-1">Points complete</span>
                      </div>
                      <span className="text-sm text-muted">
                        {totals.points_done} of {totals.total_points} story points
                      </span>
                    </div>
                    <div className="workload-progress-track" style={{ height: '10px' }}>
                      <div className="workload-segment done" style={{ width: `${completion}%` }} />
                      <div className="workload-segment todo" style={{ width: `${100 - completion}%` }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="ds-card glass">
                  <CardHeader>
                    <span className="ds-section-icon">
                      <FireIcon weight="bold" />
                    </span>
                    <CardTitle>Priority Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="flex items-center gap-2 text-xs text-red-400">
                        <FireIcon weight="fill" /> Urgent
                      </span>
                      <strong className="text-sm">{summary?.priority_urgent || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="flex items-center gap-2 text-xs text-amber-500">
                        <ArrowUpIcon weight="bold" /> High
                      </span>
                      <strong className="text-sm">{summary?.priority_high || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="flex items-center gap-2 text-xs text-blue-400">
                        <PushPinIcon weight="bold" /> Medium
                      </span>
                      <strong className="text-sm">{summary?.priority_medium || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <ArrowDownIcon weight="bold" /> Low
                      </span>
                      <strong className="text-sm">{summary?.priority_low || 0}</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'active_work' && (
            <div className="space-y-4">
              <Card className="ds-card glass">
                <CardHeader>
                  <span className="ds-section-icon">
                    <LightningIcon weight="bold" />
                  </span>
                  <CardTitle>Currently moving</CardTitle>
                </CardHeader>
                <CardContent>
                  <DashboardTicketList
                    tickets={inProgressTickets}
                    emptyText={loading ? 'Loading active work...' : 'No tickets currently moving.'}
                    showDue
                    onTicketClick={setActiveTicketId}
                  />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="ds-card glass">
                  <CardHeader>
                    <span className="ds-section-icon text-red-400">
                      <WarningIcon weight="bold" />
                    </span>
                    <CardTitle>Needs attention</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DashboardTicketList
                      tickets={blockedTickets}
                      emptyText={loading ? 'Loading blockers...' : 'No blocked sprint issues.'}
                      showDue
                      showBlockers
                      onTicketClick={setActiveTicketId}
                    />
                  </CardContent>
                </Card>

                <Card className="ds-card glass">
                  <CardHeader>
                    <span className="ds-section-icon text-amber-500">
                      <PushPinIcon weight="bold" />
                    </span>
                    <CardTitle>Unassigned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DashboardTicketList
                      tickets={unassignedTickets}
                      emptyText={loading ? 'Loading unassigned scope...' : 'All sprint issues are assigned.'}
                      showDue
                      onTicketClick={setActiveTicketId}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <Card className="ds-card glass">
              <CardHeader>
                <span className="ds-section-icon">
                  <UsersThreeIcon weight="bold" />
                </span>
                <CardTitle>Team workloads & delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="teammate-workload-grid">
                  {members.map((m) => {
                    const totalTicks = m.done + m.in_progress + m.in_review;
                    const donePercent = totalTicks > 0 ? (m.done / totalTicks) * 100 : 0;
                    const reviewPercent = totalTicks > 0 ? (m.in_review / totalTicks) * 100 : 0;
                    const progressPercent = totalTicks > 0 ? (m.in_progress / totalTicks) * 100 : 0;
                    
                    return (
                      <Card className="p-4 border border-white/5 bg-white/[0.02]" key={m.id}>
                        <div className="teammate-card">
                          <div className="teammate-card-header">
                            <div className="teammate-info font-bold text-white text-sm">
                              <span className="ds-avatar" style={{ margin: 0 }}>
                                {m.username.slice(0, 2)}
                              </span>
                              <span>@{m.username}</span>
                            </div>
                            <div className="teammate-points-badge">
                              {m.points_done} / {m.total_points} pts
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-muted mb-1 font-semibold">
                              <span>Issues breakdown ({totalTicks})</span>
                              <span>{Math.round(donePercent)}% done</span>
                            </div>
                            <div className="workload-progress-track">
                              <div className="workload-segment done" style={{ width: `${donePercent}%` }} />
                              <div className="workload-segment review" style={{ width: `${reviewPercent}%` }} />
                              <div className="workload-segment progress" style={{ width: `${progressPercent}%` }} />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div className="workload-legend border-t border-white/5 pt-4">
                  <div className="legend-item">
                    <span className="legend-color done" />
                    <span>Done</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color review" />
                    <span>In Review (PR)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color progress" />
                    <span>In Progress</span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 overflow-x-auto">
                  <Table className="dashboard-table min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Done</TableHead>
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
                            <span className="ds-person-cell">
                              <span className="ds-avatar">{m.username.slice(0, 2)}</span>
                              {m.username}
                            </span>
                          </TableCell>
                          <TableCell>{m.done}</TableCell>
                          <TableCell>{m.in_progress}</TableCell>
                          <TableCell>{m.in_review}</TableCell>
                          <TableCell>{m.points_done}</TableCell>
                          <TableCell className="text-muted">{m.total_points}</TableCell>
                        </TableRow>
                      ))}
                      {!members.length && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No team members allocated to this sprint.
                          </TableCell>
                        </TableRow>
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
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="ds-card glass xl:col-span-2">
                <CardHeader>
                  <span className="ds-section-icon">
                    <ChartBarIcon weight="bold" />
                  </span>
                  <CardTitle>Sprint Burnup Chart</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-6">
                  <BurnupChart data={burnupChart} />
                </CardContent>
              </Card>

              <Card className="ds-card glass">
                <CardHeader>
                  <span className="ds-section-icon">
                    <TargetIcon weight="bold" />
                  </span>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown summary={summary} />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'activity' && (
            <Card className="ds-card glass">
              <CardHeader>
                <span className="ds-section-icon">
                  <ActivityIcon weight="bold" />
                </span>
                <CardTitle>Sprint Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="dashboard-empty-inline">No activity recorded for tickets in this sprint yet.</div>
                ) : (
                  <div className="activity-timeline">
                    {recentActivity.map((item) => {
                      const { className, Icon } = getActivityBadgeClassAndIcon(item);
                      return (
                        <div className="activity-item" key={item.id}>
                          <div className={`activity-badge ${className}`}>
                            <Icon weight="bold" style={{ width: '10px', height: '10px' }} />
                          </div>
                          {renderActivityMessage(item, setActiveTicketId)}
                          <div className="activity-time">{timeAgo(item.created_at)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTicketId && (
        <TicketDetail ticketId={activeTicketId} onClose={() => {
          setActiveTicketId(null);
          fetchDashboardData();
        }} />
      )}
    </div>
  );
}
