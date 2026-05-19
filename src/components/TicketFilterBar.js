'use client';

export default function TicketFilterBar({ filters, onChange, users, labels, priorities }) {
  return (
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search tickets…"
        value={filters.q || ''}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        className="filter-input"
      />
      <select
        value={filters.assignee_id || ''}
        onChange={(e) => onChange({ ...filters, assignee_id: e.target.value || undefined })}
      >
        <option value="">Any assignee</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
      <select
        value={filters.priority || ''}
        onChange={(e) => onChange({ ...filters, priority: e.target.value || undefined })}
      >
        <option value="">Any priority</option>
        {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {Object.values(filters).some(Boolean) && (
        <button type="button" className="btn btn-sm" onClick={() => onChange({})}>Clear</button>
      )}
    </div>
  );
}
