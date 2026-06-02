'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverdue, daysUntil } from '@/lib/dates';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export default function TicketCard({ ticket, users, onAssign, onView }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
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
      onClick={() => {
        if (!isDragging) onView();
      }}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="ticket-card-header">
        <div className="ticket-card-number">
          <span>#{ticket.number}</span>
          <Badge className={`status-badge status-badge-${ticket.status}`} variant="outline">
            <StatusIcon weight="bold" />
            {statusMeta?.label || ticket.status}
          </Badge>
        </div>
        <div className="ticket-card-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="ticket-card-assignee-trigger"
                title="Edit assignees"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <UserPlusIcon weight="bold" />
                <span className="sr-only">Edit assignees</span>
              </Button>
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
        <div className="ticket-card-title">{ticket.title}</div>
        <div className="ticket-card-label-row">
          <Badge className={`priority-badge priority-badge-${ticket.priority}`} variant="outline">
            <PriorityIcon weight="bold" />
            {priorityMeta?.label || ticket.priority}
          </Badge>
          <span className="label-list">
            {ticket.labels?.map((label) => (
              <span key={label.id} className="label" style={{ backgroundColor: label.color }}>
                {label.name}
              </span>
            ))}
          </span>
          {hasUnresolvedBlockers && <Badge variant="destructive">Blocked</Badge>}
        </div>
        <div className="ticket-card-footer">
          <div className="ticket-card-footer-meta">
            {ticket.total_points != null && (
              <Badge variant="secondary" title="Points remaining">
                {ticket.points_remaining ?? ticket.total_points} pt. left
              </Badge>
            )}
            {ticket.status !== 'done' && ticket.due_date && (() => {
              const days = daysUntil(ticket.due_date);
              if (isOverdue(ticket.due_date)) {
                return <span className="due-date overdue">overdue</span>;
              }
              if (days <= 3) {
                return <span className="due-date due-soon">due {days === 0 ? 'today' : `in ${days}d`}</span>;
              }
              return <span className="ticket-card-muted-meta">due {ticket.due_date}</span>;
            })()}
          </div>
          <span className="ticket-card-assignee-stack" aria-label={assignees.length ? 'Assignees' : 'Unassigned'}>
            {assignees.slice(0, 4).map((assignee) => (
              <span key={assignee.id} className="ticket-card-assignee" title={assignee.username}>
                {assignee.username?.slice(0, 2)}
              </span>
            ))}
            {assignees.length > 4 && <span className="ticket-card-assignee-more">+{assignees.length - 4}</span>}
            {!assignees.length && <span className="ticket-card-unassigned">Unassigned</span>}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
