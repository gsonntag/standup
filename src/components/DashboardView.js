'use client';

import { useEffect, useState, useRef } from 'react';
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
  ArrowUpIcon,
  ArrowDownIcon,
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
  if (!tickets.length) {
    return (
      <div className="dashboard-empty-inline">
        <CheckCircleIcon className="w-5 h-5 text-muted-foreground/60" weight="light" />
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="dashboard-ticket-list flat-ticket-list">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="dashboard-ticket-row ticket-row-flat"
          onClick={() => onTicketClick(ticket.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTicketClick(ticket.id);
            }
          }}
        >
          <div className="ticket-issue-inner">
            <span className="ticket-id">#{ticket.number}</span>
            <span className="ticket-title-text">{ticket.title}</span>
          </div>
          <Badge className={`status-badge status-badge-${ticket.status}`} variant="outline">
            {ticket.status.replaceAll('_', ' ')}
          </Badge>
          {showDue && ticket.due_date && <span className="dashboard-ticket-meta">Due {formatDashboardDate(ticket.due_date)}</span>}
          {showBlockers && ticket.unresolved_blocker_count > 0 && (
            <span className="dashboard-ticket-meta dashboard-ticket-meta-danger">
              {ticket.unresolved_blocker_count} blocker{ticket.unresolved_blocker_count === 1 ? '' : 's'}
            </span>
          )}
          <span className="dashboard-ticket-meta text-muted">{assigneeLabel(ticket)}</span>
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
  let statusText = 'Healthy';
  let statusColorClass = 'text-green-500';
  let statusBgClass = 'bg-green-500/10 border-green-500/20';

  if (score < 50) {
    strokeColor = '#c9372c';
    statusText = 'Critical';
    statusColorClass = 'text-red-500';
    statusBgClass = 'bg-red-500/10 border-red-500/20';
  } else if (score < 75) {
    strokeColor = '#f5cd47';
    statusText = 'Needs Attention';
    statusColorClass = 'text-amber-500';
    statusBgClass = 'bg-amber-500/10 border-amber-500/20';
  }

  return (
    <div className="health-gauge-inner">
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
      <div className="health-gauge-status">
        <span className={`health-gauge-pill border ${statusBgClass} ${statusColorClass}`}>
          {statusText}
        </span>
        <span className="health-gauge-desc">
          Based on progress, blockers, and overdue tickets.
        </span>
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
        {actualAreaPath && (
          <path
            d={actualAreaPath}
            className="chart-area-actual"
            fill="url(#burnup-actual-grad)"
            pointerEvents="none"
          />
        )}

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
          className="chart-tooltip absolute bg-popover text-popover-foreground border border-border shadow-xl rounded-lg p-3 w-48 text-xs pointer-events-none transition-all duration-150"
          style={{
            left: `${(hoveredPoint.x / chartWidth) * 100}%`,
            top: `${(hoveredPoint.y / chartHeight) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
            zIndex: 10,
          }}
        >
          <div className="font-bold border-b border-border/40 pb-1 mb-1">{formatDashboardDate(hoveredPoint.date)}</div>
          <div className="flex gap-4 justify-between leading-normal py-0.5">
            <span className="text-muted-foreground">Total Scope:</span>
            <strong className="text-foreground">{hoveredPoint.scope} pts</strong>
          </div>
          <div className="flex gap-4 justify-between leading-normal py-0.5">
            <span className="text-muted-foreground">Ideal Burnup:</span>
            <strong className="text-foreground">{hoveredPoint.ideal} pts</strong>
          </div>
          <div className="flex gap-4 justify-between leading-normal py-0.5">
            <span className="text-indigo-400 font-medium">Actual Done:</span>
            <strong className="text-indigo-500 font-bold">{hoveredPoint.actual} pts</strong>
          </div>
        </div>
      )}

      <div className="chart-legends">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#c9372c', borderRadius: 0, height: '2px', width: '12px' }} />
          <span>Total Scope ({data[N - 1]?.scope || 0} pts)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ border: '1px dashed currentColor', opacity: 0.4, background: 'transparent', height: '2px', width: '12px' }} />
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
    { label: 'Backlog', val: summary.backlog, color: '#6b7280' },
    { label: 'To do', val: summary.todo, color: '#9ca3af' },
    { label: 'In progress', val: '#5e6ad2' },
    { label: 'PR', val: summary.in_review, color: '#f5cd47' },
    { label: 'Done', val: summary.done, color: '#27a644' },
  ].filter((s) => s.val > 0);

  const radius = 36;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const segments = statuses.map((s) => {
    const percentage = (s.val / total) * 100;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += percentage;
    return {
      ...s,
      percentage,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col items-center sm:flex-row sm:justify-around gap-6 py-4">
      <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
            className="opacity-25"
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="butt"
              className="transition-all duration-500 ease-out"
              style={{ transformOrigin: 'center' }}
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-foreground">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tickets</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-[160px] w-full">
        {statuses.map((s, i) => (
          <div key={i} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs font-semibold text-foreground">{s.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{s.val}</span>
              <span>({pct(s.val)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActivityMessage(item, onTicketClick) {
  const actor = <strong>@{item.actor_username}</strong>;
  const ticketRef = <span className="text-mono text-foreground/50">#{item.ticket_number}</span>;
  const ticketLink = (
    <strong
      className="text-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
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

const AVATAR_PALETTE = ['#5e6ad2','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
function avatarColorFor(username) {
  let h = 0;
  for (let i = 0; i < (username || '').length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function groupActivityByDate(items, parseTs) {
  const groups = new Map();
  const now = new Date();
  const todayStr = now.toDateString();
  const yd = new Date(now); yd.setDate(yd.getDate() - 1);
  const yestStr = yd.toDateString();

  for (const item of items) {
    const d = parseTs(item.created_at);
    const ds = d?.toDateString?.() || '';
    let label = ds === todayStr ? 'Today' : ds === yestStr ? 'Yesterday'
      : d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d) : 'Earlier';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return groups;
}

function ActivityFeed({ items, onTicketClick }) {
  if (!items.length) {
    return <div className="dashboard-empty-inline">No activity recorded for tickets in this sprint yet.</div>;
  }

  const groups = groupActivityByDate(items, parseTimestamp);

  return (
    <div className="activity-feed-v2">
      {[...groups.entries()].map(([dateLabel, groupItems]) => (
        <div key={dateLabel} className="activity-group">
          <div className="activity-group-label">{dateLabel}</div>
          <div className="activity-group-items">
            {groupItems.map((item) => {
              const { className: typeClass, Icon } = getActivityBadgeClassAndIcon(item);
              const avatarColor = avatarColorFor(item.actor_username);
              const initials = (item.actor_username || '?').slice(0, 2).toUpperCase();

              return (
                <div className="activity-row" key={item.id}>
                  <div className="activity-row-left">
                    <div className="activity-row-avatar" style={{ background: `${avatarColor}22`, color: avatarColor, borderColor: `${avatarColor}44` }}>
                      {initials}
                    </div>
                    <div className={`activity-row-type-dot ${typeClass}`}>
                      <Icon weight="bold" />
                    </div>
                  </div>
                  <div className="activity-row-body">
                    <div className="activity-row-headline">
                      {buildActivityHeadline(item, onTicketClick)}
                    </div>
                    {item.kind === 'comment' && item.new_value && (
                      <div className="activity-row-comment">{item.new_value}</div>
                    )}
                  </div>
                  <div className="activity-row-time">{timeAgo(item.created_at)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildActivityHeadline(item, onTicketClick) {
  const actor = <span className="activity-actor">@{item.actor_username}</span>;
  const ticket = (
    <button
      type="button"
      className="activity-ticket-link"
      onClick={() => onTicketClick(item.ticket_id)}
    >
      <span className="activity-ticket-num">#{item.ticket_number}</span>
      {' '}{item.ticket_title}
    </button>
  );

  if (item.kind === 'comment') return <>{actor} <span className="activity-action">commented on</span> {ticket}</>;
  if (item.field === 'status') {
    const to = item.new_value?.replaceAll('_', ' ') || 'none';
    return <>{actor} <span className="activity-action">moved</span> {ticket} <span className="activity-action">to <strong>{to}</strong></span></>;
  }
  if (item.field === 'assignee') {
    return item.new_value
      ? <>{actor} <span className="activity-action">assigned</span> {ticket} <span className="activity-action">to <strong>@{item.new_value}</strong></span></>
      : <>{actor} <span className="activity-action">unassigned</span> {ticket}</>;
  }
  if (item.field === 'priority') {
    return <>{actor} <span className="activity-action">set priority of</span> {ticket} <span className="activity-action">to <strong className="capitalize">{item.new_value}</strong></span></>;
  }
  return <>{actor} <span className="activity-action">updated</span> {ticket}</>;
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

  const prevSprintIdRef = useRef('');
  const isFirstFetchRef = useRef(true);

  const fetchDashboardData = (targetSprintId) => {
    const query = targetSprintId ? `?sprint_id=${targetSprintId}` : '';
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
        if (d.sprint?.id && !targetSprintId) {
          prevSprintIdRef.current = d.sprint.id;
          setSprintId(d.sprint.id);
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false;
      prevSprintIdRef.current = sprintId;
      fetchDashboardData(sprintId);
      return;
    }
    if (sprintId === prevSprintIdRef.current) {
      return;
    }
    prevSprintIdRef.current = sprintId;
    fetchDashboardData(sprintId);
  }, [sprintId]);

  useRealtime((event) => {
    if (['ticket', 'comment', 'sprint'].includes(event.kind)) {
      fetchDashboardData(sprintId);
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
  
  let healthScore = 100;
  if (totals.total_points > 0) {
    healthScore = Math.max(0, 100 - (100 - completion) * 0.6);
  } else if (summary && summary.total_tickets > 0) {
    const ticketCompletion = Math.round((summary.done / summary.total_tickets) * 100);
    healthScore = Math.max(0, 100 - (100 - ticketCompletion) * 0.6);
  } else {
    healthScore = 100;
  }
  healthScore -= Math.min(20, blockedCount * 10);
  healthScore -= Math.min(20, overdueCount * 5);
  healthScore -= Math.min(10, unassignedCount * 3);
  healthScore = Math.round(Math.max(0, healthScore));

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
              {sprints.length === 0 ? (
                <SelectItem value="none">No sprints</SelectItem>
              ) : (
                <SelectItem value="none">Select sprint...</SelectItem>
              )}
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
        <Card className="dashboard-empty-card ds-card">
          <CardContent>No sprints yet. Create one on the Sprints page.</CardContent>
        </Card>
      )}

      {sprintId && (
        <>
          <div className="dashboard-topnav">
            <nav className="dashboard-topnav-tabs">
              {[
                { key: 'overview',     label: 'Overview' },
                { key: 'active_work',  label: 'Active Scope' },
                { key: 'team',         label: 'Team Workload' },
                { key: 'analytics',    label: 'Analytics' },
                { key: 'activity',     label: 'Activity Feed' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`dashboard-topnav-tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {sprint && (
              <div className="dashboard-topnav-meta">
                <Badge variant={sprint.status === 'active' ? 'default' : 'outline'} className="shrink-0">{sprint.status}</Badge>
                <span className="dashboard-topnav-dates">{sprint.start_date} – {sprint.end_date}</span>
                {timeText && <span className="linear-muted-chip shrink-0">{timeText}</span>}
              </div>
            )}
          </div>

          {activeTab === 'overview' && (
            <div className="bento-overview">
              {sprint && timeText && (
                <div className="sprint-timeline-row">
                  <div className="sprint-timeline-header">
                    <span className="sprint-timeline-label">Sprint Duration</span>
                    <span className="sprint-timeline-meta">
                      {sprint.start_date} – {sprint.end_date}
                      <span className="sprint-timeline-pct">{timeElapsedPercent}% elapsed</span>
                    </span>
                  </div>
                  <div className="sprint-timeline-bar-wrap">
                    <div className="sprint-time-progress-bar" style={{ margin: 0 }}>
                      <div className="sprint-time-progress-fill" style={{ width: `${timeElapsedPercent}%` }} />
                    </div>
                    {timeText && <span className="sprint-timeline-remaining">{timeText}</span>}
                  </div>
                </div>
              )}

              <div className="bento-row-top">
                <Card className="ds-card bento-health flex flex-col justify-center items-center py-8">
                  <SprintHealthGauge score={healthScore} />
                </Card>

                <div className="bento-stats">
                  {summaryCards.map(({ label, value, icon: Icon, tone }) => (
                    <Card className="dashboard-summary-card ds-card" data-tone={tone} key={label}>
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

              <div className="bento-row-bottom">
                <Card className="ds-card">
                  <CardHeader>
                    <span className="ds-section-icon">
                      <TargetIcon weight="bold" />
                    </span>
                    <CardTitle>Sprint Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-3xl font-extrabold text-foreground">{completion}%</span>
                        <span className="text-xs text-muted-foreground block mt-1">Points complete</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {totals.points_done} of {totals.total_points} story points
                      </span>
                    </div>
                    <div className="workload-progress-track" style={{ height: '10px' }}>
                      <div className="workload-segment done" style={{ width: `${completion}%` }} />
                      <div className="workload-segment todo" style={{ width: `${100 - completion}%` }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="ds-card">
                  <CardHeader>
                    <span className="ds-section-icon">
                      <FireIcon weight="bold" />
                    </span>
                    <CardTitle>Priority Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const urgent = summary?.priority_urgent || 0;
                      const high = summary?.priority_high || 0;
                      const medium = summary?.priority_medium || 0;
                      const low = summary?.priority_low || 0;
                      const total = urgent + high + medium + low;

                      const priorities = [
                        { label: 'Critical', count: urgent, hex: '#ef4444', Icon: FireIcon },
                        { label: 'High',     count: high,   hex: '#f59e0b', Icon: ArrowUpIcon },
                        { label: 'Medium',   count: medium, hex: '#5e6ad2', Icon: PushPinIcon },
                        { label: 'Low',      count: low,    hex: '#6b7280', Icon: ArrowDownIcon },
                      ].filter((p) => p.count > 0);

                      if (total === 0) {
                        return <div className="dashboard-empty-inline">No tickets in this sprint yet.</div>;
                      }

                      const radius = 38;
                      const strokeWidth = 10;
                      const circumference = 2 * Math.PI * radius;
                      let acc = 0;
                      const segments = priorities.map((p) => {
                        const pct = p.count / total;
                        const dash = `${pct * circumference} ${circumference}`;
                        const offset = -(acc * circumference);
                        acc += pct;
                        return { ...p, dash, offset };
                      });

                      return (
                        <div className="priority-donut-layout">
                          <div className="priority-donut-chart">
                            <svg viewBox="0 0 100 100" width="100%" height="100%">
                              <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} opacity="0.2" />
                              {segments.map((seg, i) => (
                                <circle
                                  key={i}
                                  cx="50" cy="50" r={radius}
                                  fill="none"
                                  stroke={seg.hex}
                                  strokeWidth={strokeWidth}
                                  strokeDasharray={seg.dash}
                                  strokeDashoffset={seg.offset}
                                  strokeLinecap="butt"
                                  className="transition-all duration-500 ease-out"
                                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                />
                              ))}
                            </svg>
                            <div className="priority-donut-center">
                              <span className="text-2xl font-extrabold text-foreground">{total}</span>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">tickets</span>
                            </div>
                          </div>
                          <div className="priority-donut-legend">
                            {priorities.map(({ label, count, hex, Icon }) => (
                              <div key={label} className="priority-legend-row">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                    <Icon weight="bold" className="w-3 h-3" style={{ color: hex }} />
                                    {label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="font-bold text-foreground">{count}</span>
                                  <span>({Math.round((count / total) * 100)}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'active_work' && (
            <div className="space-y-8">
              <Card className="ds-card">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="ds-card">
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

                <Card className="ds-card">
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
            <Card className="ds-card">
              <CardHeader>
                <span className="ds-section-icon">
                  <UsersThreeIcon weight="bold" />
                </span>
                <CardTitle>Team workloads & delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-7">
                <div className="teammate-workload-grid">
                  {members.map((m) => {
                    const totalTicks = m.done + m.in_progress + m.in_review;
                    const donePercent = totalTicks > 0 ? (m.done / totalTicks) * 100 : 0;
                    const reviewPercent = totalTicks > 0 ? (m.in_review / totalTicks) * 100 : 0;
                    const progressPercent = totalTicks > 0 ? (m.in_progress / totalTicks) * 100 : 0;
                    
                    return (
                      <div className="teammate-card-item" key={m.id}>
                        <div className="teammate-card-top">
                          <div className="teammate-card-identity">
                            <span className="teammate-avatar">
                              {m.username.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <span className="teammate-name">@{m.username}</span>
                              <span className="teammate-subtitle">{totalTicks} assigned</span>
                            </div>
                          </div>
                          <div className="teammate-card-pts">
                            <span className="teammate-pts-value">{m.points_done}<span className="teammate-pts-total"> / {m.total_points} pts</span></span>
                            <span className="teammate-pts-label">done</span>
                          </div>
                        </div>
                        <div className="teammate-card-progress">
                          <div className="workload-progress-track h-2 rounded-full overflow-hidden flex">
                            <div className="workload-segment bg-[#27a644]" style={{ width: `${donePercent}%` }} title={`Done: ${Math.round(donePercent)}%`} />
                            <div className="workload-segment bg-[#f59e0b]" style={{ width: `${reviewPercent}%` }} title={`In Review: ${Math.round(reviewPercent)}%`} />
                            <div className="workload-segment bg-[#5e6ad2]" style={{ width: `${progressPercent}%` }} title={`In Progress: ${Math.round(progressPercent)}%`} />
                          </div>
                          <div className="teammate-card-legend">
                            <span><span className="w-2 h-2 rounded-full bg-[#27a644] inline-block" /> {m.done} done</span>
                            <span><span className="w-2 h-2 rounded-full bg-[#5e6ad2] inline-block" /> {m.in_progress} active</span>
                            <span><span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" /> {m.in_review} review</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="workload-legend mt-2">
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

                <div className="dashboard-team-table-wrap">
                  <div className="table-container">
                  <Table className="dashboard-table flat-data-table min-w-full">
                    <TableHeader>
                      <TableRow className="ticket-table-head-row">
                        <TableHead className="ticket-col-head ticket-col-static">Member</TableHead>
                        <TableHead className="ticket-col-head ticket-col-static" style={{ width: 72 }}>Done</TableHead>
                        <TableHead className="ticket-col-head ticket-col-static" style={{ width: 100 }}>In Progress</TableHead>
                        <TableHead className="ticket-col-head ticket-col-static" style={{ width: 56 }}>PR</TableHead>
                        <TableHead className="ticket-col-head ticket-col-static" style={{ width: 100 }}>Points Done</TableHead>
                        <TableHead className="ticket-col-head ticket-col-static" style={{ width: 100 }}>Total Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.id} className="ticket-row">
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
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-7 items-start">
              <Card className="ds-card xl:col-span-2">
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

              <Card className="ds-card">
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
            <Card className="ds-card">
              <CardHeader>
                <span className="ds-section-icon">
                  <ActivityIcon weight="bold" />
                </span>
                <CardTitle>Sprint Activity Feed</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <ActivityFeed items={recentActivity} onTicketClick={setActiveTicketId} />
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
