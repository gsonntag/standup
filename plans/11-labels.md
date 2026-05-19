# Phase 11: Labels

## Goal

Build the label system. Users can create labels with a name and preset color, then assign them to tickets via the ticket detail modal.

---

## Component: `src/components/LabelPicker.js` — Client Component

This component is used inside the TicketDetail modal (Phase 8) to add/remove labels on a ticket.

### Props
```js
{
  ticketId: string,        // The ticket being edited
  currentLabels: array,    // Labels currently on the ticket: [{ id, name, color }]
  onUpdate: function,      // Called after any change so parent can refetch
}
```

### Layout

```
┌───────────────────────────────┐
│  LABELS                       │
│  [bug ×] [frontend ×]         │
│                               │
│  [+ add label]                │
│                               │
│  (when picker is open:)       │
│  ┌───────────────────────┐    │
│  │ Search: [________]    │    │
│  │ ☐ blocked    ■        │    │
│  │ ☐ design     ■        │    │
│  │ ☐ devops     ■        │    │
│  │ ─────────────────     │    │
│  │ Create new label:     │    │
│  │ Name: [_______]       │    │
│  │ Color: ■ ■ ■ ■ ■ ■   │    │
│  │        ■ ■ ■ ■ ■ ■   │    │
│  │        ■ ■ ■ ■       │    │
│  │ [Create]              │    │
│  └───────────────────────┘    │
└───────────────────────────────┘
```

### Behavior

**Current labels**: Shown as colored badges with a "×" button each. Clicking "×" removes the label from the ticket.

**"+ add label" button**: Toggles the picker dropdown open/closed.

**Picker dropdown** (shown when open):
1. **Search input** — filters the list of all labels by name (case-insensitive)
2. **Label list** — shows all labels from `/api/labels`. Labels already on the ticket are checked/highlighted. Clicking an unchecked label adds it; clicking a checked label removes it.
3. **Create new label section** — at the bottom of the dropdown, separated by a line

### Adding a label to a ticket
```js
async function addLabel(labelId) {
  await fetch(`/api/tickets/${ticketId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label_id: labelId }),
  });
  onUpdate();
}
```

### Removing a label from a ticket
```js
async function removeLabel(labelId) {
  await fetch(`/api/tickets/${ticketId}/labels`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label_id: labelId }),
  });
  onUpdate();
}
```

### Creating a new label

The "Create new label" section has:
1. **Name input** — text, required
2. **Color grid** — the 16 preset colors from `LABEL_COLORS` in constants.js, shown as clickable squares
3. **Create button** — creates the label and immediately adds it to the ticket

```js
import { LABEL_COLORS } from '@/lib/constants';

// State for new label form
const [newName, setNewName] = useState('');
const [newColor, setNewColor] = useState(LABEL_COLORS[0].hex);

async function createLabel() {
  if (!newName.trim()) return;

  // Create the label
  const res = await fetch('/api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName.trim(), color: newColor }),
  });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Failed to create label');
    return;
  }

  // Add it to the ticket
  await addLabel(data.label.id);

  // Reset form
  setNewName('');
  setNewColor(LABEL_COLORS[0].hex);

  // Refresh all labels list
  fetchAllLabels();
}
```

### Color Grid CSS

Add these styles to `globals.css`:

```css
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: var(--space-sm) 0;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-swatch:hover {
  border-color: var(--text);
}

.color-swatch.selected {
  border-color: var(--text);
  outline: 1px solid var(--bg);
}

.label-picker-dropdown {
  border: 1px solid var(--border);
  padding: var(--space-md);
  margin-top: var(--space-sm);
  background: var(--bg);
  max-height: 300px;
  overflow-y: auto;
}

.label-picker-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.label-picker-item:hover {
  background: var(--bg-alt);
}

.label-picker-item .label {
  pointer-events: none;
}
```

### Integration with TicketDetail

In the TicketDetail component (Phase 8), the labels section renders LabelPicker:

```js
<div className="detail-field">
  <div className="detail-field-label">Labels</div>
  <LabelPicker
    ticketId={ticket.id}
    currentLabels={ticket.labels}
    onUpdate={fetchTicket}
  />
</div>
```

## Deleting Labels

Labels can be deleted from the picker dropdown. Add a small "×" next to each label in the list that deletes the label globally (from all tickets).

```js
async function deleteLabel(labelId) {
  if (!confirm('Delete this label from all tickets?')) return;
  await fetch(`/api/labels/${labelId}`, { method: 'DELETE' });
  fetchAllLabels();
  onUpdate(); // Refresh ticket to remove deleted label
}
```

## Verification

1. Open a ticket detail → labels section shows empty
2. Click "+ add label" → picker dropdown opens
3. In the create section, type "bug", select red, click Create → label created and added to ticket
4. Label badge appears on ticket card (Board and Backlog)
5. Open picker again → "bug" is checked. Click another label to add it.
6. Click "×" on a label badge → label removed from ticket
7. Create multiple labels → they appear in picker dropdown
8. Search filters labels by name
9. Delete a label → removed from all tickets

Phase 11 complete. The MVP is fully specified.

---

## Post-MVP Notes

After all 11 phases are implemented, the application should be fully functional with:
- Login / logout
- Kanban board with drag-and-drop
- Backlog management with ticket creation
- Sprint lifecycle (create, start, complete)
- Ticket detail with editing, comments, dependencies, labels
- Team management with admin user creation
- Utilitarian, fast UI with system fonts and flat design
