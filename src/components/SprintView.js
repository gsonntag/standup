'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  RowsIcon,
  TargetIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import AppPageHeader from './AppPageHeader';
import { AppActions, AppEmptyState, AppField } from './AppUI';

function parseDate(value) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  const date = parseDate(value);
  if (!date) return 'Select date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function SprintDatePicker({ id, value, onChange, placeholder }) {
  const selectedDate = parseDate(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="sprint-date-picker-trigger"
        >
          <CalendarBlankIcon weight="bold" />
          <span className={value ? '' : 'text-muted-foreground'}>{value ? formatDateLabel(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="sprint-date-picker-popover" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (date) onChange(formatDateValue(date));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function SprintForm({ mode, sprint, onSaved, onCancel }) {
  const [name, setName] = useState(sprint?.name || '');
  const [startDate, setStartDate] = useState(sprint?.start_date || '');
  const [endDate, setEndDate] = useState(sprint?.end_date || '');
  const [ticketOptions, setTicketOptions] = useState([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/tickets?limit=500&exclude_status=done')
      .then((res) => res.json())
      .then((data) => {
        const tickets = data.tickets || [];
        setTicketOptions(tickets);
        if (sprint?.id) {
          setSelectedTicketIds(new Set(tickets.filter((ticket) => ticket.sprint_id === sprint.id).map((ticket) => ticket.id)));
        }
      });
  }, [sprint?.id]);

  function dateFromToday(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name is required.');
    if (!startDate) return setError('Start date is required.');
    if (!endDate || new Date(endDate) <= new Date(startDate)) return setError('End date must be after start date.');

    const res = await apiFetch(sprint ? `/api/sprints/${sprint.id}` : '/api/sprints', {
      method: sprint ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || `Failed to ${sprint ? 'update' : 'create'} sprint.`);
    const targetSprintId = data.sprint.id;
    const selectedIds = [...selectedTicketIds];
    const previousIds = ticketOptions.filter((ticket) => sprint?.id && ticket.sprint_id === sprint.id).map((ticket) => ticket.id);
    const toAssign = selectedIds.filter((id) => ticketOptions.find((ticket) => ticket.id === id)?.sprint_id !== targetSprintId);
    const toRemove = previousIds.filter((id) => !selectedTicketIds.has(id));

    await Promise.all([
      ...toAssign.map((ticketId) => apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: targetSprintId, status: 'todo' }),
      })),
      ...toRemove.map((ticketId) => apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: null, status: 'backlog' }),
      })),
    ]);
    onSaved(data.sprint);
  }

  function toggleTicket(ticketId) {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  }

  const selectableTickets = ticketOptions.filter((ticket) => !ticket.sprint_id || ticket.sprint_id === sprint?.id);

  return (
    <form onSubmit={handleSubmit} className="sprint-form">
      <div className="sprint-form-grid">
        <AppField id={`${mode}-sprint-name-${sprint?.id || 'new'}`} label="Name" icon={FlagIcon} className="sprint-form-field sprint-form-field-wide">
          <Input id={`${mode}-sprint-name-${sprint?.id || 'new'}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </AppField>
        <AppField
          id={`${mode}-sprint-start-${sprint?.id || 'new'}`}
          label="Start Date"
          icon={CalendarBlankIcon}
          actions={<Button type="button" size="sm" variant="outline" className="sprint-date-shortcut" onClick={() => setStartDate(dateFromToday(0))}>Today</Button>}
          className="sprint-form-field"
        >
          <SprintDatePicker
            id={`${mode}-sprint-start-${sprint?.id || 'new'}`}
            value={startDate}
            onChange={setStartDate}
            placeholder="Choose start date"
          />
        </AppField>
        <AppField
          id={`${mode}-sprint-end-${sprint?.id || 'new'}`}
          label="End Date"
          icon={CalendarBlankIcon}
          actions={(
            <div className="sprint-date-shortcuts">
              <Button type="button" size="sm" variant="outline" className="sprint-date-shortcut" onClick={() => setEndDate(dateFromToday(7))}>+1 week</Button>
              <Button type="button" size="sm" variant="outline" className="sprint-date-shortcut" onClick={() => setEndDate(dateFromToday(14))}>+2 weeks</Button>
            </div>
          )}
          className="sprint-form-field"
        >
          <SprintDatePicker
            id={`${mode}-sprint-end-${sprint?.id || 'new'}`}
            value={endDate}
            onChange={setEndDate}
            placeholder="Choose end date"
          />
        </AppField>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="sprint-ticket-selector">
        <div className="sprint-ticket-selector-header">
          <Label className="app-field-label">
            <RowsIcon weight="bold" />
            Tickets
          </Label>
          <span>{selectedTicketIds.size} selected</span>
        </div>
        <div className="sprint-ticket-list">
          {selectableTickets.length === 0 && <div className="my-tasks-empty">No backlog tickets available.</div>}
          {selectableTickets.map((ticket) => (
            <div
              role="button"
              tabIndex={0}
              key={ticket.id}
              className="sprint-ticket-option"
              onClick={() => toggleTicket(ticket.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleTicket(ticket.id);
                }
              }}
            >
              <Checkbox checked={selectedTicketIds.has(ticket.id)} onCheckedChange={() => toggleTicket(ticket.id)} onClick={(e) => e.stopPropagation()} />
              <span className="sprint-ticket-option-main">
                <strong>#{ticket.number} {ticket.title}</strong>
                <span>{ticket.assignee_username || 'Unassigned'} · {ticket.priority}</span>
              </span>
              <Badge variant="outline">{ticket.status}</Badge>
            </div>
          ))}
        </div>
      </div>
      <AppActions className="sprint-form-footer">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" className="tickets-new-button">
          {mode === 'create' ? <PlusIcon weight="bold" /> : <CheckCircleIcon weight="bold" />}
          {mode === 'create' ? 'Create sprint' : 'Save sprint'}
        </Button>
      </AppActions>
    </form>
  );
}

function SprintCard({ sprint, isAdmin, onAction, onEdit, onCompleteWithRollover }) {
  const ticketCount = sprint.ticket_count || 0;
  const doneCount = sprint.done_count || 0;
  const progress = ticketCount ? Math.round((doneCount / ticketCount) * 100) : 0;
  const statusVariant = sprint.status === 'active' ? 'default' : sprint.status === 'completed' ? 'secondary' : 'outline';

  return (
    <Card className={`sprint-card ds-card sprint-card-${sprint.status}${sprint.status === 'active' ? ' sprint-card-active' : ''}`}>
      <CardHeader className="sprint-card-header">
        <div className="sprint-card-title-group">
          <div className="sprint-card-icon" aria-hidden="true">
            {sprint.status === 'active' ? <PlayIcon weight="fill" /> : sprint.status === 'completed' ? <CheckCircleIcon weight="fill" /> : <ClockIcon weight="bold" />}
          </div>
          <div>
            <CardTitle className="sprint-card-name">{sprint.name}</CardTitle>
            <div className="sprint-dates">
              <CalendarBlankIcon weight="bold" />
              {sprint.start_date} <ArrowRightIcon weight="bold" /> {sprint.end_date}
            </div>
          </div>
        </div>
        <Badge className="sprint-status-badge" variant={statusVariant}>{sprint.status}</Badge>
      </CardHeader>
      <CardContent>
      <div className="sprint-progress-row">
        <div className="sprint-progress-meta">
          <span>{doneCount}/{ticketCount} issues done</span>
          <span>{progress}% complete</span>
        </div>
        <div className="sprint-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="sprint-metrics">
        <div className="sprint-metric">
          <RowsIcon weight="bold" />
          <span>{ticketCount} issues</span>
        </div>
        <div className="sprint-metric">
          <CheckCircleIcon weight="bold" />
          <span>{doneCount} done</span>
        </div>
        {sprint.total_points > 0 && (
          <div className="sprint-metric">
            <TargetIcon weight="bold" />
            <span>{sprint.points_remaining}/{sprint.total_points} pts remaining</span>
          </div>
        )}
      </div>
      <div className="sprint-card-actions">
        <Button asChild size="sm" variant="outline"><a href={`/sprints/${sprint.id}/retro`}>Retro</a></Button>
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={() => onEdit(sprint)}><PencilSimpleIcon weight="bold" />Edit</Button>
            {sprint.status === 'planning' && (
              <>
                <Button size="sm" className="tickets-new-button" onClick={() => onAction('start', sprint.id)}><PlayIcon weight="bold" />Start sprint</Button>
                <Button size="sm" variant="destructive" onClick={() => onAction('delete', sprint.id)}><TrashIcon weight="bold" />Delete</Button>
              </>
            )}
            {sprint.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => onCompleteWithRollover(sprint.id)}><CheckCircleIcon weight="bold" />Complete sprint</Button>
            )}
          </>
        )}
      </div>
      </CardContent>
    </Card>
  );
}

export default function SprintView({ currentUser }) {
  const [sprints, setSprints] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [completingSprintId, setCompletingSprintId] = useState(null);
  const [rolloverDestination, setRolloverDestination] = useState('backlog');

  async function fetchSprints() {
    const res = await apiFetch('/api/sprints');
    const data = await res.json();
    setSprints(data.sprints || []);
  }

  useEffect(() => {
    fetchSprints();
  }, []);

  async function handleAction(action, sprintId) {
    if (action === 'start') {
      const res = await apiFetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to start sprint.');
        return;
      }
    } else if (action === 'delete') {
      if (!confirm('Delete this sprint? Tickets will be unassigned.')) return;
      await apiFetch(`/api/sprints/${sprintId}`, { method: 'DELETE' });
    }
    fetchSprints();
  }

  function handleCompleteWithRollover(sprintId) {
    setRolloverDestination('backlog');
    setCompletingSprintId(sprintId);
  }

  async function confirmComplete() {
    const res = await apiFetch(`/api/sprints/${completingSprintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', rollover_to: rolloverDestination }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to complete sprint.');
    }
    setCompletingSprintId(null);
    fetchSprints();
  }

  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { active: 0, planning: 1, completed: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.start_date) - new Date(a.start_date);
  });
  const isAdmin = currentUser?.role === 'admin';
  const planningSprints = sprints.filter((s) => s.status === 'planning');
  const activeCount = sprints.filter((s) => s.status === 'active').length;
  const planningCount = sprints.filter((s) => s.status === 'planning').length;
  const completedCount = sprints.filter((s) => s.status === 'completed').length;

  return (
    <div className="page">
      <AppPageHeader
        icon={RowsIcon}
        eyebrow="Planning"
        title="Sprints"
        subtitle="Plan LA Hacks engineering work into focused delivery windows."
        actions={isAdmin && <Button size="sm" className="tickets-new-button" onClick={() => setShowCreateForm(true)}><PlusIcon weight="bold" />New sprint</Button>}
      />
      {showCreateForm && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCreateForm(false); }}>
          <DialogContent className="sprint-dialog">
            <DialogHeader>
              <DialogTitle>New sprint</DialogTitle>
              <DialogDescription>Create a sprint window for the team board.</DialogDescription>
            </DialogHeader>
            <SprintForm
              mode="create"
              onSaved={() => {
                setShowCreateForm(false);
                fetchSprints();
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      {editingSprint && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditingSprint(null); }}>
          <DialogContent className="sprint-dialog">
            <DialogHeader>
              <DialogTitle>Edit sprint</DialogTitle>
              <DialogDescription>Update the sprint name or dates without changing its current tickets.</DialogDescription>
            </DialogHeader>
              <SprintForm
                mode="edit"
                sprint={editingSprint}
                onSaved={() => {
                  setEditingSprint(null);
                  fetchSprints();
                }}
                onCancel={() => setEditingSprint(null)}
              />
          </DialogContent>
        </Dialog>
      )}
      {completingSprintId && (
        <Dialog open onOpenChange={(open) => { if (!open) setCompletingSprintId(null); }}>
          <DialogContent className="sprint-complete-dialog">
            <DialogHeader>
              <DialogTitle>Complete sprint</DialogTitle>
              <DialogDescription>Choose where unfinished tickets should go after this sprint closes.</DialogDescription>
            </DialogHeader>
              <AppField id="sprint-rollover" label="Move unfinished tickets to" icon={RowsIcon} className="sprint-form-field">
              <Select value={rolloverDestination} onValueChange={setRolloverDestination}>
                <SelectTrigger id="sprint-rollover" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="next_planning">Next planning sprint (oldest)</SelectItem>
                {planningSprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
                </SelectContent>
              </Select>
              </AppField>
              <AppActions className="sprint-form-footer">
                <Button type="button" size="sm" variant="outline" onClick={() => setCompletingSprintId(null)}>Cancel</Button>
                <Button type="button" size="sm" className="tickets-new-button" onClick={confirmComplete}><CheckCircleIcon weight="bold" />Complete sprint</Button>
              </AppActions>
          </DialogContent>
        </Dialog>
      )}
      <div className="sprint-summary-grid">
        <div className="sprint-summary-card"><span>Active</span><strong>{activeCount}</strong></div>
        <div className="sprint-summary-card"><span>Planning</span><strong>{planningCount}</strong></div>
        <div className="sprint-summary-card"><span>Completed</span><strong>{completedCount}</strong></div>
      </div>
      <div className="sprint-list">
        {sortedSprints.map((sprint) => (
          <SprintCard
            key={sprint.id}
            sprint={sprint}
            isAdmin={isAdmin}
            onAction={handleAction}
            onEdit={setEditingSprint}
            onCompleteWithRollover={handleCompleteWithRollover}
          />
        ))}
      </div>
      {sprints.length === 0 && (
        <AppEmptyState
          title="No sprints yet"
          description={isAdmin ? 'Create a sprint window to start planning work.' : 'Ask an admin to create one.'}
          action={isAdmin ? <Button type="button" size="sm" className="tickets-new-button" onClick={() => setShowCreateForm(true)}><PlusIcon weight="bold" />Create a sprint</Button> : null}
        />
      )}
    </div>
  );
}
