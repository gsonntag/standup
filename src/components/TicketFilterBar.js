'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TicketFilterBar({ filters, onChange, users, labels, priorities }) {
  return (
    <div className="filter-bar">
      <Input
        type="text"
        placeholder="Search tickets…"
        value={filters.q || ''}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        className="filter-input"
      />
      <Select
        value={filters.assignee_id ? String(filters.assignee_id) : 'all'}
        onValueChange={(value) => onChange({ ...filters, assignee_id: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Any assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any assignee</SelectItem>
          {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={filters.priority || 'all'}
        onValueChange={(value) => onChange({ ...filters, priority: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Any priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any priority</SelectItem>
          {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {Object.values(filters).some(Boolean) && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({})}>Clear</Button>
      )}
    </div>
  );
}
