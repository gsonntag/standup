'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TicketCard from './TicketCard';

export default function BoardColumn({ currentUser, status, tickets, users, onTicketAssign, onTicketView, wipLimit }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });
  const isOverLimit = wipLimit && tickets.length > wipLimit;

  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? 'drop-target' : ''}`}>
      <div className={`board-column-header${isOverLimit ? ' over-limit' : ''}`}>
        <span>{status.label}</span>
        <span className="board-column-count">{tickets.length}{wipLimit ? ` / ${wipLimit}` : ''}</span>
      </div>
      <div className="board-column-body">
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
        </SortableContext>
      </div>
    </div>
  );
}
