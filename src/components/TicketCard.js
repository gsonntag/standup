'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverdue, daysUntil } from '@/lib/dates';

export default function TicketCard({ ticket, users, onAssign, onView }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const hasUnresolvedBlockers = ticket.unresolved_blocker_count > 0;

  function handleAction(e, action) {
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  function handleAssign(e) {
    e.stopPropagation();
    onAssign(e.target.value);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ticket-card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="ticket-card-header">
        <div className="ticket-card-number">#{ticket.number}</div>
        <div className="ticket-card-actions">
          <button
            type="button"
            className="btn btn-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onView)}
          >
            View
          </button>
          <select
            className="ticket-card-assignee-select"
            value={ticket.assignee_id || ''}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={handleAssign}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="ticket-card-title">{ticket.title}</div>
      <div className="ticket-card-meta">
        <span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span>
        <span className="label-list">
          {ticket.labels?.map((label) => (
            <span key={label.id} className="label" style={{ backgroundColor: label.color }}>
              {label.name}
            </span>
          ))}
        </span>
        {ticket.due_date && (() => {
          const days = daysUntil(ticket.due_date);
          if (isOverdue(ticket.due_date)) {
            return <span className="due-date overdue">overdue</span>;
          }
          if (days <= 3) {
            return <span className="due-date due-soon">due {days === 0 ? 'today' : `in ${days}d`}</span>;
          }
          return null;
        })()}
        {hasUnresolvedBlockers && <span className="ticket-card-blocked">BLOCKED</span>}
        {ticket.total_points != null && (
          <span className="ticket-card-points" title="Points remaining / total">
            {ticket.points_remaining ?? ticket.total_points}/{ticket.total_points}pt
          </span>
        )}
        {ticket.assignee_username && (
          <span className="ticket-card-assignee" title={ticket.assignee_username}>
            {ticket.assignee_username.slice(0, 2)}
          </span>
        )}
      </div>
    </div>
  );
}
