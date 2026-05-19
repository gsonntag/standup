'use client';

import { useDroppable } from '@dnd-kit/core';
import TicketCard from './TicketCard';

export default function BoardColumn({ currentUser, status, tickets, users, onTicketAssign, onTicketView }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });

  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? 'drop-target' : ''}`}>
      <div className="board-column-header">
        <span>{status.label}</span>
        <span className="board-column-count">{tickets.length}</span>
      </div>
      <div className="board-column-body">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            currentUser={currentUser}
            users={users}
            onAssign={(assigneeId) => onTicketAssign(ticket.id, assigneeId)}
            onView={() => onTicketView(ticket.id)}
          />
        ))}
      </div>
    </div>
  );
}
