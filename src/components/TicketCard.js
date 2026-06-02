'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverdue, daysUntil } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TicketCard({ ticket, users, onAssign, onView }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const hasUnresolvedBlockers = ticket.unresolved_blocker_count > 0;

  function handleAction(e, action) {
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`ticket-card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="ticket-card-header">
        <div className="ticket-card-number">#{ticket.number}</div>
        <div className="ticket-card-actions">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onView)}
          >
            View
          </Button>
          <Select
            value={ticket.assignee_id || 'unassigned'}
            onPointerDown={(e) => e.stopPropagation()}
            onValueChange={(value) => onAssign(value === 'unassigned' ? '' : value)}
          >
            <SelectTrigger className="ticket-card-assignee-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
      <div className="ticket-card-title">{ticket.title}</div>
      <div className="ticket-card-meta">
        <Badge className={`priority-badge priority-badge-${ticket.priority}`} variant="outline">
          {ticket.priority}
        </Badge>
        <span className="label-list">
          {ticket.labels?.map((label) => (
            <span key={label.id} className="label" style={{ backgroundColor: label.color }}>
              {label.name}
            </span>
          ))}
        </span>
        {ticket.status !== 'done' && ticket.due_date && (() => {
          const days = daysUntil(ticket.due_date);
          if (isOverdue(ticket.due_date)) {
            return <span className="due-date overdue">overdue</span>;
          }
          if (days <= 3) {
            return <span className="due-date due-soon">due {days === 0 ? 'today' : `in ${days}d`}</span>;
          }
          return null;
        })()}
        {hasUnresolvedBlockers && <Badge variant="destructive">Blocked</Badge>}
        {ticket.total_points != null && (
          <Badge variant="secondary" title="Points remaining">
            {ticket.points_remaining ?? ticket.total_points} pt. left
          </Badge>
        )}
        {ticket.assignee_username && (
          <span className="ticket-card-assignee" title={ticket.assignee_username}>
            {ticket.assignee_username.slice(0, 2)}
          </span>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
