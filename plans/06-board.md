# Phase 6: Board Page (Kanban)

## Goal

Build the Kanban board — the default page at `/`. Shows tickets for the active sprint in columns by status. Supports drag-and-drop to change ticket status.

---

## Prerequisites

Install drag-and-drop dependencies:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Components

### `src/app/page.js` — Board Page (Server Component)

This is the entry point. It fetches the active sprint server-side and renders the Board client component.

```js
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Board from '@/components/Board';

export default async function BoardPage() {
  const user = await getCurrentUser();
  const db = getDb();

  // Find the active sprint
  const activeSprint = db.prepare(
    "SELECT * FROM sprints WHERE status = 'active' LIMIT 1"
  ).get();

  return (
    <div className="page">
      <div className="page-header">
        <h1>{activeSprint ? activeSprint.name : 'Board'}</h1>
        {activeSprint && (
          <span className="text-muted text-sm">
            {activeSprint.start_date} → {activeSprint.end_date}
          </span>
        )}
      </div>
      {!activeSprint ? (
        <div className="empty">
          No active sprint. Go to <a href="/sprints">Sprints</a> to start one.
        </div>
      ) : (
        <Board sprintId={activeSprint.id} currentUser={user} />
      )}
    </div>
  );
}
```

### `src/components/Board.js` — Client Component

This is the main Kanban board. It:
1. Fetches tickets for the active sprint via `/api/tickets?sprint_id=...`
2. Groups tickets into columns by status
3. Renders a `BoardColumn` for each status
4. Handles drag-and-drop to move tickets between columns

```
Layout:
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Backlog  │ To Do    │ In Prog  │ Review   │ Done     │
│          │          │          │          │          │
│ [card]   │ [card]   │ [card]   │          │ [card]   │
│ [card]   │          │          │          │          │
│          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Key behaviors**:
- Uses `@dnd-kit/core` `DndContext` for drag-and-drop
- When a card is dropped on a column, PATCH `/api/tickets/[id]` with the new `status`
- Optimistic update: move the card in state immediately, revert if API fails
- Clicking a card opens the TicketDetail modal (Phase 8)

**State**:
```js
const [tickets, setTickets] = useState([]);
const [selectedTicketId, setSelectedTicketId] = useState(null);
```

**Drag-and-drop implementation**:
```js
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';

function handleDragEnd(event) {
  const { active, over } = event;
  if (!over) return;

  const ticketId = active.id;
  const newStatus = over.id; // column ID = status value

  // Optimistic update
  setTickets(prev => prev.map(t =>
    t.id === ticketId ? { ...t, status: newStatus } : t
  ));

  // API call
  fetch(`/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  }).catch(() => {
    // Revert on failure — refetch all tickets
    fetchTickets();
  });
}
```

**Each column** is a droppable area with `useDroppable`:
```js
import { useDroppable } from '@dnd-kit/core';

function BoardColumn({ status, tickets, onTicketClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });

  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? 'drop-target' : ''}`}>
      <div className="board-column-header">
        <span>{status.label}</span>
        <span className="board-column-count">{tickets.length}</span>
      </div>
      <div className="board-column-body">
        {tickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### `src/components/TicketCard.js` — Client Component

Each card in the board. Uses `useDraggable` from dnd-kit.

```js
import { useDraggable } from '@dnd-kit/core';

export default function TicketCard({ ticket, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
  });

  const hasUnresolvedBlockers = ticket.unresolved_blocker_count > 0;

  return (
    <div
      ref={setNodeRef}
      className={`ticket-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="ticket-card-number">#{ticket.number}</div>
      <div className="ticket-card-title">{ticket.title}</div>
      <div className="ticket-card-meta">
        <span className={`priority priority-${ticket.priority}`}>
          {ticket.priority}
        </span>
        {ticket.labels?.map(label => (
          <span key={label.id} className="label" style={{ backgroundColor: label.color }}>
            {label.name}
          </span>
        ))}
        {hasUnresolvedBlockers && (
          <span className="ticket-card-blocked">BLOCKED</span>
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
```

### Rendering the TicketDetail modal

When `selectedTicketId` is set, render the TicketDetail modal (built in Phase 8). For now, just add a placeholder:

```js
{selectedTicketId && (
  <div className="modal-overlay" onClick={() => setSelectedTicketId(null)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <p>Ticket detail for {selectedTicketId} — Phase 8</p>
    </div>
  </div>
)}
```

## Data Fetching

The Board component fetches tickets on mount and whenever the sprint changes:

```js
useEffect(() => {
  fetchTickets();
}, [sprintId]);

async function fetchTickets() {
  const res = await fetch(`/api/tickets?sprint_id=${sprintId}`);
  const data = await res.json();
  setTickets(data.tickets);
}
```

## Verification

1. Create a sprint via API, start it (set status to `active`)
2. Create some tickets assigned to that sprint with various statuses
3. Visit `/` → should see 5 columns with tickets in the right columns
4. Drag a card from "To Do" to "In Progress" → card moves, status is persisted
5. Refresh the page → card stays in new column
6. Card shows: `#1`, title, priority badge, labels, assignee initials
7. Tickets with unresolved blockers show "BLOCKED" in red

Phase 6 complete. Move to Phase 7.
