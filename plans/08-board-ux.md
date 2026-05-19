# Board UX: WIP Limits, Swimlanes, Drag Rollback Feedback

## 1. WIP limits per column

Optional cap on the number of tickets allowed in a column. Configured per sprint (so a long-running planning sprint and an active sprint can have different caps).

### Schema

```sql
CREATE TABLE IF NOT EXISTS sprint_wip_limits (
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  status    TEXT NOT NULL,
  max_count INTEGER NOT NULL,
  PRIMARY KEY (sprint_id, status)
);
```

### API

- `GET /api/sprints/[id]/wip` → `{ limits: [{ status, max_count }] }`.
- `PUT /api/sprints/[id]/wip` (admin) → replaces the list.

### UI

- Column header renders `In Progress (3 / 5)`. Color the count red when over the cap.
- The cap is **soft**: dragging into a full column is allowed but the column header pulses red until count ≤ cap. We do not block the drop — scrum WIP limits are signals, not enforcement.
- Settings UI: a small "WIP Limits" admin panel on the board page (gear icon) lets admins set per-status caps.

## 2. Swimlanes

A swimlane groups rows on the board horizontally. Toggle the lane key from a select in the board header.

Options:
- **None** (current behavior).
- **By assignee** — one lane per user with tickets in the current sprint, plus an "Unassigned" lane.
- **By priority** — one lane per priority value (urgent → low).

### UI implementation

- `Board.js` already renders columns. Wrap them in a per-lane container so the grid becomes: rows of lanes, each lane containing the four column slots.
- Each `(lane, column)` cell is its own `SortableContext` so drag-and-drop reorders within the cell (and across columns/lanes updates the corresponding field).
- Dropping a card into a lane updates the lane key field (e.g. `assignee_id` or `priority`) in the same PATCH that updates status/position.

No schema change.

## 3. Optimistic rollback feedback

`Board.js:38` does optimistic move + `:43` silently refetches on PATCH failure. The card jumps back with no explanation.

### Fix

- Hold the pre-drag column/position in local state when the drag starts.
- On PATCH failure: restore the pre-drag state and surface a toast (`Failed to move "Fix login redirect": Server rejected the change`). Keep the existing `apiFetch` error JSON.
- Add a lightweight toast component (`Toast.js`) — non-blocking, top-right, 4s auto-dismiss. Reuse it elsewhere (bulk ops, etc.).
- Do not refetch on every failure; only refetch if the error suggests stale data (HTTP 409 or 404).

## Acceptance

- A column shows `(count / limit)` and reddens when over.
- The swimlane select on the board groups cards by assignee or priority; drag-drops update the appropriate field.
- A drag that fails server-side reverts the card to its origin and shows a toast.
