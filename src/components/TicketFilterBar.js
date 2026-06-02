'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

export default function TicketFilterBar({ filters, onChange, users, labels, priorities, statuses = [], sort, onSortChange }) {
  const sortValue = sort?.by && sort?.dir ? `${sort.by}:${sort.dir}` : 'number:desc';

  return (
    <div className="tickets-action-bar">
      <div className="tickets-search-control">
        <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Search tickets or #"
          value={filters.q || ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="filter-input tickets-search-input"
        />
      </div>
      <Select
        value={filters.assignee_id ? String(filters.assignee_id) : 'all'}
        onValueChange={(value) => onChange({ ...filters, assignee_id: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="tickets-filter-trigger w-48">
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
        <SelectTrigger className="tickets-filter-trigger w-44">
          <SelectValue placeholder="Any priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any priority</SelectItem>
          {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={filters.status || 'open'}
        onValueChange={(value) => onChange({ ...filters, status: value === 'open' ? undefined : value })}
      >
        <SelectTrigger className="tickets-filter-trigger w-40">
          <SelectValue placeholder="Open tickets" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open tickets</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortValue} onValueChange={(value) => {
        const [by, dir] = value.split(':');
        onSortChange?.({ by, dir });
      }}>
        <SelectTrigger className="tickets-filter-trigger w-44">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="number:desc">Ticket # newest</SelectItem>
          <SelectItem value="number:asc">Ticket # oldest</SelectItem>
          <SelectItem value="priority:desc">Priority high first</SelectItem>
          <SelectItem value="priority:asc">Priority low first</SelectItem>
          <SelectItem value="assignee:asc">Assignee A-Z</SelectItem>
          <SelectItem value="sprint:asc">Sprint A-Z</SelectItem>
        </SelectContent>
      </Select>
      {Object.values(filters).some(Boolean) && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({})}>Clear</Button>
      )}
    </div>
  );
}
