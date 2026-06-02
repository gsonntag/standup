'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { isOverdue, daysUntil, parseTimestamp } from '@/lib/dates';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { labelPillStyle } from '@/lib/labels';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  CircleIcon,
  FireIcon,
  FlagIcon,
  KanbanIcon,
  RocketLaunchIcon,
  SpinnerGapIcon,
  TimerIcon,
  UserPlusIcon,
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

function formatShortDate(value) {
  const date = parseTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function assigneeInitials(username = '') {
  const clean = String(username || '').replace(/^@/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export default function TicketCard({ ticket, users, onAssign, onView, onLabelClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const titleRef = useRef(null);
  const [titleLines, setTitleLines] = useState(2);
  const hasUnresolvedBlockers = ticket.unresolved_blocker_count > 0;
  const assignees = ticket.assignees?.length
    ? ticket.assignees
    : ticket.assignee_id
      ? [{ id: ticket.assignee_id, username: ticket.assignee_username }]
      : [];
  const statusMeta = STATUSES.find((status) => status.value === ticket.status);
  const priorityMeta = PRIORITIES.find((priority) => priority.value === ticket.priority);
  const StatusIcon = STATUS_ICONS[ticket.status] || CircleIcon;
  const PriorityIcon = PRIORITY_ICONS[ticket.priority] || FlagIcon;
  const createdDate = formatShortDate(ticket.created_at);
  const dueDate = formatShortDate(ticket.due_date);
  const assigneeText = assignees.length ? assignees.map((assignee) => `@${assignee.username}`).join(', ') : 'Unassigned';
  const pointText = ticket.total_points != null
    ? `${ticket.points_remaining ?? ticket.total_points} pt${(ticket.points_remaining ?? ticket.total_points) === 1 ? '' : 's'} left`
    : '';

  useEffect(() => {
    const titleEl = titleRef.current;
    if (!titleEl) return undefined;

    function updateTitleLines() {
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const lineCount = new Set(
        [...range.getClientRects()].map((rect) => Math.round(rect.top))
      ).size;
      range.detach?.();
      setTitleLines(lineCount > 1 ? 2 : 1);
    }

    updateTitleLines();
    const observer = new ResizeObserver(updateTitleLines);
    observer.observe(titleEl);
    return () => observer.disconnect();
  }, [ticket.title]);

  function dueDateLabel() {
    if (!ticket.due_date) return 'No due date';
    const days = daysUntil(ticket.due_date);
    if (isOverdue(ticket.due_date)) return 'Overdue';
    if (days <= 3) return days === 0 ? 'Today' : `In ${days}d`;
    return dueDate || ticket.due_date;
  }

  function toggleAssignee(userId) {
    const selected = new Set(assignees.map((assignee) => assignee.id));
    if (selected.has(userId)) selected.delete(userId);
    else selected.add(userId);
    onAssign([...selected]);
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`ticket-card ${isDragging ? 'dragging' : ''}`}
      data-title-lines={titleLines}
      onClick={() => {
        if (!isDragging) onView();
      }}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="ticket-card-header">
        <div className="ticket-card-number">
          <span>#{ticket.number}</span>
        </div>
        <div className="ticket-card-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-slot="button"
                className={`ticket-card-assignee-trigger${assignees.length ? ' has-assignees' : ''}`}
                title="Edit assignees"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {assignees.length ? (
                  <span className="ticket-card-avatar-stack" aria-hidden="true">
                    {assignees.slice(0, 2).map((assignee) => (
                      <span key={assignee.id || assignee.username} className="ticket-card-avatar">
                        {assigneeInitials(assignee.username)}
                      </span>
                    ))}
                    {assignees.length > 2 && <span className="ticket-card-avatar-more">+{assignees.length - 2}</span>}
                  </span>
                ) : (
                  <UserPlusIcon weight="bold" />
                )}
                <span className="sr-only">Edit assignees</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ticket-card-assignee-menu" onPointerDown={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Assignees</DropdownMenuLabel>
              {users.map((user) => (
                <DropdownMenuCheckboxItem
                  key={user.id}
                  checked={assignees.some((assignee) => assignee.id === user.id)}
                  onCheckedChange={() => toggleAssignee(user.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  @{user.username}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="ticket-card-title-row">
          <span className={`ticket-card-status-icon status-icon-${ticket.status}`} title={statusMeta?.label || ticket.status}>
            <StatusIcon weight="fill" />
          </span>
          <div ref={titleRef} className="ticket-card-title">{ticket.title}</div>
        </div>
        <div className="ticket-card-label-row">
          <span className={`linear-priority-chip linear-priority-${ticket.priority}`} title={priorityMeta?.label || ticket.priority}>
            <span className="linear-priority-dot" />
            <PriorityIcon weight="bold" />
            {priorityMeta?.label || ticket.priority}
          </span>
          {ticket.due_date && (
            <span className={`ticket-card-chip ticket-card-due-chip${isOverdue(ticket.due_date) && ticket.status !== 'done' ? ' overdue' : ''}${!isOverdue(ticket.due_date) && daysUntil(ticket.due_date) <= 3 && ticket.status !== 'done' ? ' due-soon' : ''}`} title="Due date">
              <CalendarBlankIcon weight="bold" />
              {dueDateLabel()}
            </span>
          )}
          {ticket.total_points != null && (
            <span className="ticket-card-chip ticket-card-points-chip" title="Points remaining">
              <ChartBarIcon weight="bold" />
              {pointText}
            </span>
          )}
          <span className="label-list linear-label-list">
            {ticket.labels?.map((label) => (
              <button
                key={label.id}
                type="button"
                className="label linear-label"
                style={labelPillStyle(label.color)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  (onLabelClick || onView)?.();
                }}
              >
                <span className="linear-label-dot" />
                {label.name}
              </button>
            ))}
          </span>
          {hasUnresolvedBlockers && <span className="ticket-card-chip ticket-card-blocked-chip">Blocked</span>}
        </div>
        <div className="ticket-card-footer">
          <span>Created {createdDate || '-'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
