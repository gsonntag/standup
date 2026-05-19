# Phase 9: Sprint Management Page

## Goal

Build the sprints page at `/sprints`. Admins can create, start, and complete sprints. All users can view sprint status and ticket counts.

---

## Component: `src/app/sprints/page.js` — Server Component

```js
import { getCurrentUser } from '@/lib/auth';
import SprintView from '@/components/SprintView';

export default async function SprintsPage() {
  const user = await getCurrentUser();
  return <SprintView currentUser={user} />;
}
```

## Component: `src/components/SprintView.js` — Client Component

### State
```js
const [sprints, setSprints] = useState([]);
const [showCreateForm, setShowCreateForm] = useState(false);
```

### Data Fetching
```js
useEffect(() => { fetchSprints(); }, []);

async function fetchSprints() {
  const res = await fetch('/api/sprints');
  const data = await res.json();
  setSprints(data.sprints);
}
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Sprints                        [+ New Sprint]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Sprint 2          PLANNING                 │    │
│  │  Jun 15 → Jun 28   3 tickets                │    │
│  │                     [Start Sprint]  [Delete] │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Sprint 1          ACTIVE                   │    │
│  │  Jun 1 → Jun 14    5/8 done                 │    │
│  │                     [Complete Sprint]        │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Sprint 0          COMPLETED                │    │
│  │  May 18 → May 31   12/12 done               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Sprint Card

Each sprint renders as a `.sprint-card`:

```js
function SprintCard({ sprint, isAdmin, onAction }) {
  return (
    <div className="sprint-card">
      <div className="sprint-card-header">
        <span className="sprint-card-name">{sprint.name}</span>
        <span className={`sprint-status sprint-status-${sprint.status}`}>
          {sprint.status}
        </span>
      </div>
      <div className="sprint-dates">
        {sprint.start_date} → {sprint.end_date}
      </div>
      <div className="sprint-progress">
        {sprint.status === 'completed'
          ? `${sprint.done_count}/${sprint.ticket_count} done`
          : `${sprint.ticket_count} tickets · ${sprint.done_count} done`}
      </div>
      {isAdmin && (
        <div className="mt-lg flex gap-md">
          {sprint.status === 'planning' && (
            <>
              <button className="btn btn-sm btn-primary"
                onClick={() => onAction('start', sprint.id)}>
                Start Sprint
              </button>
              <button className="btn btn-sm btn-danger"
                onClick={() => onAction('delete', sprint.id)}>
                Delete
              </button>
            </>
          )}
          {sprint.status === 'active' && (
            <button className="btn btn-sm"
              onClick={() => onAction('complete', sprint.id)}>
              Complete Sprint
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**"+ New Sprint" button**: Only visible if `currentUser.role === 'admin'`. Toggles the create form.

### Create Sprint Form

Shown inline above the sprint list. Admin only.

**Fields**:
| Field | Input Type | Notes |
|-------|-----------|-------|
| Name | `<input type="text">` | Required. e.g. "Sprint 3" |
| Start Date | `<input type="date">` | Required. YYYY-MM-DD |
| End Date | `<input type="date">` | Required. Must be after start date |

```
┌─────────────────────────────────────────┐
│  New Sprint                             │
│  NAME       [Sprint 3_______________]   │
│  START DATE [2026-06-15]                │
│  END DATE   [2026-06-28]                │
│  [Create]  [Cancel]                     │
└─────────────────────────────────────────┘
```

**Submit**: POST `/api/sprints` with `{ name, start_date, end_date }`

**Client-side validation**:
- Name is required
- Start date is required
- End date is required and must be after start date

### Sprint Actions

All actions are admin-only. The `onAction` handler:

```js
async function handleAction(action, sprintId) {
  if (action === 'start') {
    const res = await fetch(`/api/sprints/${sprintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error); // e.g., "Another sprint is already active"
      return;
    }
  } else if (action === 'complete') {
    if (!confirm('Complete this sprint? Unfinished tickets will move to backlog.')) return;
    await fetch(`/api/sprints/${sprintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
  } else if (action === 'delete') {
    if (!confirm('Delete this sprint? Tickets will be unassigned.')) return;
    await fetch(`/api/sprints/${sprintId}`, { method: 'DELETE' });
  }
  fetchSprints();
}
```

### Sprint Order

Display sprints in this order:
1. Active sprints first (should be at most 1)
2. Planning sprints next (by start_date ascending)
3. Completed sprints last (by end_date descending)

Sort client-side:
```js
const sortedSprints = [...sprints].sort((a, b) => {
  const order = { active: 0, planning: 1, completed: 2 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  return new Date(b.start_date) - new Date(a.start_date);
});
```

## Verification

1. Visit `/sprints` as admin → shows "No sprints" initially
2. Click "+ New Sprint" → form appears
3. Create sprint with name and dates → sprint card appears with "PLANNING" badge
4. Click "Start Sprint" → badge changes to "ACTIVE"
5. Try to start another sprint → error "Another sprint is already active"
6. Visit Board `/` → now shows the active sprint's tickets
7. Click "Complete Sprint" → unfinished tickets move to backlog, badge changes to "COMPLETED"
8. As a non-admin user → no create/start/complete/delete buttons visible

Phase 9 complete. Move to Phase 10.
