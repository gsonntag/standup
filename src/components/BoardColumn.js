'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TicketCard from './TicketCard';

export default function BoardColumn({ currentUser, status, tickets, users, onTicketAssign, onTicketView, wipLimit }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });
  const isOverLimit = wipLimit && tickets.length > wipLimit;

  return (
    <Card ref={setNodeRef} className={`board-column ${isOver ? 'drop-target' : ''}`}>
      <CardHeader className={`board-column-header${isOverLimit ? ' over-limit' : ''}`}>
        <CardTitle className="text-sm">{status.label}</CardTitle>
        <Badge variant={isOverLimit ? 'destructive' : 'secondary'}>{tickets.length}{wipLimit ? ` / ${wipLimit}` : ''}</Badge>
      </CardHeader>
      <CardContent className="board-column-body">
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
          {tickets.length === 0 && (
            <div className="board-column-empty">
              Drop issues here
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}
