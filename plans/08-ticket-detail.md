# Phase 8: Ticket Detail

## Goal

Build the ticket detail modal that opens when clicking a ticket card (from Board or Backlog). It shows all ticket fields, allows editing, and includes a comment thread, dependencies, and label management.

---

## Component: `src/components/TicketDetail.js` — Client Component

This is a modal that overlays the current page. It receives a `ticketId` and an `onClose` callback.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  #3 Fix login bug                             [×]   │
├─────────────────────┬───────────────────────────────┤
│                     │  STATUS      [In Progress ▾]  │
│  DESCRIPTION        │  PRIORITY    [High ▾]         │
│  ┌───────────────┐  │  ASSIGNEE    [gavin ▾]        │
│  │ ## Summary    │  │  SPRINT      [Sprint 1 ▾]     │
│  │ Fix the auth  │  │                               │
│  │ flow when...  │  │  LABELS                       │
│  │               │  │  [bug] [frontend] [+ add]     │
│  └───────────────┘  │                               │
│                     │  DEPENDENCIES                  │
│  COMMENTS           │  Blocked by:                  │
│  ─────────────      │  ✓ #1 Setup DB                │
│  gavin · 2h ago     │  ✗ #2 Auth system             │
│  Looks good to me   │  [+ add blocker]              │
│                     │                               │
│  gavin · 1h ago     │  Unblocks:                    │
│  Merged.            │  #5 Add search                │
│                     │  #6 Write tests               │
│  [comment input]    │                               │
│  [Add comment]      │  [Delete ticket]              │
├─────────────────────┴───────────────────────────────┤
```

### Data Fetching

On mount (and when `ticketId` changes), fetch:
1. `GET /api/tickets/[id]` — returns ticket with `blockers`, `unblocks`, and `labels`
2. `GET /api/tickets/[id]/comments` — returns comments
3. `GET /api/users` — for assignee dropdown
4. `GET /api/sprints` — for sprint dropdown
5. `GET /api/labels` — for label picker

### Editable Fields

Each field in the sidebar is a `<select>` that auto-saves on change (no save button).

**Status**: `<select>` with options from `STATUSES` constant.
**Priority**: `<select>` with options from `PRIORITIES` constant.
**Assignee**: `<select>` with options = all users + an empty "Unassigned" option.
**Sprint**: `<select>` with options = all non-completed sprints + "No sprint (backlog)" option.

**On change for any field**:
```js
async function updateField(field, value) {
  await fetch(`/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value || null }),
  });
  // Refetch ticket to get updated data
  fetchTicket();
}
```

### Title Editing

The title is displayed as an `<input>` that looks like text. It saves on blur.

```js
<input
  className="detail-title-input"
  value={title}
  onChange={e => setTitle(e.target.value)}
  onBlur={() => updateField('title', title)}
/>
```

CSS for `.detail-title-input`:
```css
.detail-title-input {
  font-size: var(--font-size-lg);
  font-weight: 600;
  border: 1px solid transparent;
  padding: var(--space-xs) var(--space-sm);
  width: 100%;
}
.detail-title-input:hover {
  border-color: var(--border);
}
.detail-title-input:focus {
  border-color: var(--focus);
}
```

### Description Editing

The description is a `<textarea>` that saves on blur. It uses monospace font for markdown editing.

```js
<textarea
  value={description}
  onChange={e => setDescription(e.target.value)}
  onBlur={() => updateField('description', description)}
  rows={10}
/>
```

### Labels Section

Shows current labels as badges. Has an "+ add" button that opens the LabelPicker (Phase 11). Each label has a small "×" to remove it.

**Remove label**: `DELETE /api/tickets/[id]/labels` with `{ label_id }`
**Add label**: `POST /api/tickets/[id]/labels` with `{ label_id }`

### Dependencies Section

Two sub-sections:

#### "Blocked by" (blockers)
Lists tickets that this ticket depends on. Each shows:
- ✓ (green) or ✗ (red) depending on whether the blocker is done or not
- Ticket number and title
- "×" button to remove the dependency

**Remove**: `DELETE /api/tickets/[id]/dependencies` with `{ depends_on_id }`

**"+ add blocker" button**: Opens the DependencyPicker component.

#### DependencyPicker (`src/components/DependencyPicker.js`)

A simple search/select interface:
1. Text input to search tickets by number or title
2. Dropdown list of matching tickets (filtered from `/api/tickets`)
3. Click to add as dependency
4. Cannot add self, cannot add tickets already in the blockers list

**Search**: Fetch all tickets once, filter client-side by title or number matching the search string.

**Add**: `POST /api/tickets/[id]/dependencies` with `{ depends_on_id }`

#### "Unblocks" section
Lists tickets that depend on THIS ticket. Read-only — just informational. Each item is a link that opens that ticket in the detail modal.

### Comment Thread

**Component**: `src/components/CommentThread.js`

Shows comments in chronological order (oldest first). Below the list is a form to add a new comment.

**Each comment**:
```
─────────────────────
gavin · 2 hours ago
Looks good to me, let's merge.
```

**Timestamp formatting**: Use relative time. Implement a simple helper:
```js
function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Add comment form**:
- `<textarea>` for comment content
- "Add comment" button
- On submit: POST `/api/tickets/[id]/comments` with `{ content }`
- On success: append new comment to list, clear textarea

### Delete Ticket

A "Delete ticket" button at the bottom of the sidebar. Uses `.btn-danger` class.

On click:
1. `confirm("Delete this ticket?")` — browser native confirm dialog
2. If confirmed: `DELETE /api/tickets/[id]`
3. On success: close modal, trigger a refresh of the parent page's ticket list

### Closing the Modal

- Click the "×" button in the header
- Click the overlay background
- Press Escape key

```js
useEffect(() => {
  function handleEsc(e) {
    if (e.key === 'Escape') onClose();
  }
  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [onClose]);
```

### Callback to Parent

The `onClose` callback should accept an optional argument indicating if data changed:
```js
onClose({ deleted: false, updated: true })
```

The parent (Board or Backlog) uses this to know whether to refetch its ticket list.

## Integration with Board and Backlog

In both `Board.js` and `BacklogView.js`, replace the placeholder modal with:

```js
{selectedTicketId && (
  <TicketDetail
    ticketId={selectedTicketId}
    onClose={({ deleted, updated } = {}) => {
      setSelectedTicketId(null);
      if (deleted || updated) fetchTickets();
    }}
  />
)}
```

## Verification

1. Click a ticket card on the Board → modal opens with all ticket data
2. Change status via dropdown → saves immediately, card moves on board after closing
3. Change assignee → saves immediately
4. Edit title, blur → saves
5. Edit description, blur → saves
6. Add a comment → appears in thread
7. Add a blocker → appears in "Blocked by" list
8. Complete the blocker ticket → its icon changes from ✗ to ✓
9. Check "Unblocks" section shows correct tickets
10. Delete ticket → confirm dialog → ticket removed, modal closes
11. Press Escape → modal closes
12. Click overlay → modal closes

Phase 8 complete. Move to Phase 9.
