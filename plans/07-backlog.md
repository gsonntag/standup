# Phase 7: Backlog Page

## Goal

Build the backlog page at `/backlog`. It shows all tickets not assigned to a sprint in a table. Users can create new tickets, reorder them, and move them into a sprint.

---

## Components

### `src/app/backlog/page.js` — Server Component

Fetches initial data server-side: backlog tickets, all sprints in `planning` status (for the "move to sprint" dropdown), and all users (for assignee dropdown).

```js
import { getCurrentUser } from '@/lib/auth';
import BacklogView from '@/components/BacklogView';

export default async function BacklogPage() {
  const user = await getCurrentUser();
  return <BacklogView currentUser={user} />;
}
```

### `src/components/BacklogView.js` — Client Component

This is the main backlog component. It manages state and renders the table + create form.

**State**:
```js
const [tickets, setTickets] = useState([]);
const [users, setUsers] = useState([]);
const [sprints, setSprints] = useState([]);
const [showCreateForm, setShowCreateForm] = useState(false);
const [selectedTicketId, setSelectedTicketId] = useState(null);
```

**Data fetching on mount**:
```js
useEffect(() => {
  fetch('/api/tickets?sprint_id=none').then(r => r.json()).then(d => setTickets(d.tickets));
  fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users));
  fetch('/api/sprints').then(r => r.json()).then(d => setSprints(d.sprints));
}, []);
```

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│  Backlog                            [+ New Ticket]  │
├─────────────────────────────────────────────────────┤
│  #  │ Title        │ Priority │ Assignee │ Labels   │
│  1  │ Fix login    │ HIGH     │ gavin    │ bug      │
│  2  │ Add search   │ MEDIUM   │ -        │ feature  │
│  3  │ Update docs  │ LOW      │ -        │          │
└─────────────────────────────────────────────────────┘
```

**Table columns**:
| Column | Width | Content |
|--------|-------|---------|
| # | 60px | Ticket number, monospace |
| Title | flex | Ticket title, clickable (opens detail) |
| Priority | 80px | Priority badge using `.priority-*` class |
| Assignee | 80px | Username or `-` |
| Labels | 120px | Label badges |
| Actions | 120px | "Move to sprint" dropdown |

**Move to Sprint**: Each row has a `<select>` dropdown listing sprints in `planning` or `active` status. When user selects a sprint:
1. PATCH `/api/tickets/[id]` with `{ sprint_id: selectedSprintId, status: 'todo' }`
2. Remove ticket from backlog list (optimistic)

**The select has a default empty option**: `<option value="">— move to sprint —</option>`

### `src/components/CreateTicketForm.js` — Client Component

A form shown inline above the table when "New Ticket" is clicked. Not a modal.

**Fields**:
| Field | Input Type | Notes |
|-------|-----------|-------|
| Title | `<input type="text">` | Required. Autofocus. |
| Description | `<textarea>` | Pre-filled with `TICKET_TEMPLATE` from constants.js |
| Priority | `<select>` | Options from `PRIORITIES` constant. Default: `medium` |
| Assignee | `<select>` | Options from users list. Optional. Default: none. |

**No sprint assignment on create** — new tickets always go to backlog.

**Submit behavior**:
1. POST `/api/tickets` with form data
2. On success: add new ticket to beginning of backlog list, close form, clear fields
3. On error: show error message in `.form-error`

**Cancel button**: Closes the form without saving.

```
┌─────────────────────────────────────────┐
│  New Ticket                             │
│                                         │
│  TITLE   [________________________]     │
│  PRIORITY [Medium ▾]  ASSIGNEE [- ▾]   │
│  DESCRIPTION                            │
│  [## Summary                      ]     │
│  [<!-- Brief description -->       ]     │
│  [## Acceptance Criteria           ]     │
│  [- [ ] ...                        ]     │
│                                         │
│  [Create]  [Cancel]                     │
└─────────────────────────────────────────┘
```

**Import the template**:
```js
import { TICKET_TEMPLATE, PRIORITIES } from '@/lib/constants';
```

Initialize description state with: `const [description, setDescription] = useState(TICKET_TEMPLATE);`

### Click to open ticket detail

Clicking a ticket title in the table sets `selectedTicketId`, which renders the TicketDetail modal (Phase 8). For now, use the same placeholder as the Board.

## Verification

1. Visit `/backlog` → shows empty table with "No tickets" message
2. Click "New Ticket" → form appears inline above table
3. Fill in title, submit → ticket appears in table with `#1`
4. Create several tickets → they appear in order
5. Each ticket shows priority badge, assignee (or `-`), labels
6. Select a sprint from the "move to sprint" dropdown → ticket disappears from backlog
7. Visit Board → moved ticket appears in the sprint's "To Do" column

Phase 7 complete. Move to Phase 8.
