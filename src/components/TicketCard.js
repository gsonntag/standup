'use client';

import { useDraggable } from '@dnd-kit/core';

export default function TicketCard({ ticket, users, onAssign, onView }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id });
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
        {hasUnresolvedBlockers && <span className="ticket-card-blocked">BLOCKED</span>}
        {ticket.assignee_username && (
          <span className="ticket-card-assignee" title={ticket.assignee_username}>
            {ticket.assignee_username.slice(0, 2)}
          </span>
        )}
      </div>
    </div>
  );
}
