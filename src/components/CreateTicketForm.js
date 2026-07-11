'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES, TICKET_TEMPLATE, ticketRules } from '@/lib/constants';
import { uploadPastedImage } from '@/lib/description-paste';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AppActions, AppField } from './AppUI';
import {
  CodeIcon,
  EyeIcon,
  FlagIcon,
  GitBranchIcon,
  GitForkIcon,
  HashIcon,
  ListChecksIcon,
  PlusIcon,
  TagIcon,
  TextAlignLeftIcon,
  TextTIcon,
  UserCircleIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import DescriptionPreview from './DescriptionPreview';
import ImageUploadButton from './ImageUploadButton';
import LabelPicker from './LabelPicker';

export default function CreateTicketForm({ users, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(TICKET_TEMPLATE);
  const [status, setStatus] = useState('backlog');
  const [priority, setPriority] = useState('medium');
  const [assigneeIds, setAssigneeIds] = useState(new Set());
  const [sprintId, setSprintId] = useState('');
  const [githubRepoIds, setGithubRepoIds] = useState(new Set());
  const [repositories, setRepositories] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [watcherIds, setWatcherIds] = useState(new Set());
  const [blockerIds, setBlockerIds] = useState(new Set());
  const [totalPoints, setTotalPoints] = useState('');
  const [pointsRemaining, setPointsRemaining] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/github/repositories')
      .then((res) => res.json())
      .then((data) => setRepositories(data.repositories || []));
    apiFetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(data.sprints || []));
    apiFetch('/api/tickets?limit=200&exclude_status=done')
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []));
  }, []);

  // Sprint membership defines the backlog boundary: a ticket with no sprint stays in
  // the backlog and cannot be assigned or given a due date.
  function handleSprintChange(value) {
    const next = value === 'backlog' ? '' : value;
    setSprintId(next);
    if (!next) {
      setStatus('backlog');
      setAssigneeIds(new Set());
      setDueDate('');
    } else if (status === 'backlog') {
      setStatus('todo');
    }
  }

  function toggleSetValue(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const totalParsed = totalPoints !== '' ? parseInt(totalPoints, 10) : null;
    const remainingParsed = pointsRemaining !== '' ? parseInt(pointsRemaining, 10) : null;
    const res = await apiFetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        status,
        priority,
        sprint_id: sprintId || null,
        assignee_ids: [...assigneeIds],
        github_repo_ids: Array.from(githubRepoIds),
        due_date: dueDate || null,
        label_ids: selectedLabels.map((label) => label.id),
        watcher_ids: [...watcherIds],
        blocker_ids: [...blockerIds],
        ...(totalParsed != null && totalParsed > 0 ? { total_points: totalParsed } : {}),
        ...(remainingParsed != null && remainingParsed >= 0 ? { points_remaining: remainingParsed } : {}),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Failed to create ticket.');
      return;
    }
    onCreated(data.ticket);
  }

  function appendDescriptionImage(markdown) {
    setDescription((value) => `${value.trimEnd()}\n\n${markdown}\n`);
  }

  function insertDescriptionImage(markdown, target) {
    setDescription((value) => {
      const start = target?.selectionStart ?? value.length;
      const end = target?.selectionEnd ?? value.length;
      const prefix = value.slice(0, start).replace(/\s*$/, '\n\n');
      const suffix = value.slice(end).replace(/^\s*/, '\n');
      return `${prefix}${markdown}${suffix}`;
    });
  }

  function handleDescriptionPaste(e) {
    const target = e.currentTarget;
    uploadPastedImage(e, (markdown) => insertDescriptionImage(markdown, target));
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="create-ticket-dialog" aria-describedby="create-ticket-description">
      <form onSubmit={handleSubmit} className="create-ticket-form">
        <div className="create-ticket-header">
          <div className="create-ticket-heading-icon" aria-hidden="true">
            <ListChecksIcon weight="duotone" />
          </div>
          <div>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription id="create-ticket-description" className="create-ticket-subtitle">
              Capture the work, assign ownership, and send Discord pings in one pass.
            </DialogDescription>
          </div>
        </div>
        <div className="create-ticket-content">
          <div className="create-ticket-layout">
            <div className="create-ticket-main">
              <AppField id="ticket-title" label="Title" icon={TextTIcon} className="create-ticket-title-field">
                <Input
                  id="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                  placeholder="Write a clear issue title..."
                />
              </AppField>

              <AppField
                id="ticket-description"
                label="Description"
                icon={TextAlignLeftIcon}
                help="Markdown supported. Paste or upload screenshots when helpful."
                actions={<ImageUploadButton onUploaded={appendDescriptionImage} />}
                className="create-description-group"
              >
                <div className="create-description-grid">
                  <div className="create-description-pane">
                    <div className="create-description-pane-header">
                      <CodeIcon weight="bold" />
                      Markdown
                    </div>
                    <Textarea
                      id="ticket-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onPaste={handleDescriptionPaste}
                      rows={14}
                      className="create-description-textarea"
                    />
                  </div>
                  <div className="create-description-pane create-description-preview-pane">
                    <div className="create-description-pane-header">
                      <EyeIcon weight="bold" />
                      Preview
                    </div>
                    <DescriptionPreview value={description} className="create-description-preview" />
                  </div>
                </div>
              </AppField>
            </div>

            <aside className="create-ticket-properties">
              <AppField id="ticket-priority" label="Priority" icon={FlagIcon}>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="ticket-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </AppField>
              <AppField id="ticket-sprint" label="Sprint" icon={GitForkIcon}>
                <Select value={sprintId || 'backlog'} onValueChange={handleSprintChange}>
                  <SelectTrigger id="ticket-sprint">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AppField>
              <AppField id="ticket-status" label="Status" icon={ListChecksIcon}>
                <Select value={status} onValueChange={setStatus} disabled={!sprintId}>
                  <SelectTrigger id="ticket-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.filter((item) => item.value !== 'backlog' || !sprintId).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!sprintId && <p className="ticket-property-hint">Add the ticket to a sprint to start progress.</p>}
              </AppField>
              <AppField id="ticket-assignee" label="Assignees" icon={UserCircleIcon}>
                {ticketRules.canAssign(status) ? (
                  <div className="create-ticket-check-list create-ticket-assignee-list">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="create-ticket-check-row"
                        onClick={() => toggleSetValue(setAssigneeIds, user.id)}
                      >
                        <Checkbox checked={assigneeIds.has(user.id)} aria-hidden="true" tabIndex={-1} />
                        <span>@{user.username}</span>
                      </button>
                    ))}
                    {!users.length && <div className="ticket-detail-empty">No team members yet.</div>}
                  </div>
                ) : (
                  <p className="ticket-property-hint">Add the ticket to a sprint before assigning it.</p>
                )}
              </AppField>
              <AppField id="ticket-github-repos" label="Repositories" icon={GitBranchIcon}>
                <div className="create-ticket-check-list">
                  {repositories.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      className="create-ticket-check-row"
                      onClick={() => toggleSetValue(setGithubRepoIds, repo.id)}
                    >
                      <Checkbox checked={githubRepoIds.has(repo.id)} aria-hidden="true" tabIndex={-1} />
                      <span>{repo.full_name}</span>
                    </button>
                  ))}
                  {!repositories.length && <div className="ticket-detail-empty">No repositories configured.</div>}
                </div>
              </AppField>
              <AppField id="ticket-due-date" label="Due Date" icon={FlagIcon}>
                {ticketRules.canSetDueDate(sprintId) ? (
                  <Input
                    id="ticket-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                ) : (
                  <p className="ticket-property-hint">A due date can be set once the ticket is in a sprint.</p>
                )}
              </AppField>
              <div className="create-ticket-points">
                <AppField id="ticket-total-points" label="Total Points" icon={HashIcon}>
                  <Input
                    id="ticket-total-points"
                    type="number"
                    min="1"
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(e.target.value)}
                    placeholder="—"
                  />
                </AppField>
                <AppField id="ticket-points-remaining" label="Points Remaining" icon={HashIcon}>
                  <Input
                    id="ticket-points-remaining"
                    type="number"
                    min="0"
                    value={pointsRemaining}
                    onChange={(e) => setPointsRemaining(e.target.value)}
                    placeholder="same"
                  />
                </AppField>
              </div>
              <AppField id="ticket-labels" label="Labels" icon={TagIcon}>
                <LabelPicker currentLabels={selectedLabels} onChange={setSelectedLabels} />
              </AppField>
              <AppField
                id="ticket-watchers"
                label="Watchers"
                icon={UsersIcon}
                help="Watchers receive ticket activity pings."
              >
                <div className="create-ticket-check-list">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="create-ticket-check-row"
                      onClick={() => toggleSetValue(setWatcherIds, user.id)}
                    >
                      <Checkbox checked={watcherIds.has(user.id)} aria-hidden="true" tabIndex={-1} />
                      <span>@{user.username}</span>
                    </button>
                  ))}
                </div>
              </AppField>
              <AppField
                id="ticket-blockers"
                label="Blocked by"
                icon={GitForkIcon}
                help="Pick existing tickets that must be completed first."
              >
                <div className="create-ticket-check-list">
                  {tickets.slice(0, 12).map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="create-ticket-check-row"
                      onClick={() => toggleSetValue(setBlockerIds, ticket.id)}
                    >
                      <Checkbox checked={blockerIds.has(ticket.id)} aria-hidden="true" tabIndex={-1} />
                      <span className="text-mono">#{ticket.number}</span>
                      <span>{ticket.title}</span>
                      <Badge className={`priority-badge priority-badge-${ticket.priority}`} variant="outline">{ticket.priority}</Badge>
                    </button>
                  ))}
                  {!tickets.length && <div className="ticket-detail-empty">No open tickets available.</div>}
                </div>
              </AppField>
            </aside>
          </div>
        </div>
        {error && <div className="form-error create-ticket-error">{error}</div>}
        <AppActions className="create-ticket-footer">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={loading} className="create-ticket-submit">
            <PlusIcon weight="bold" />
            {loading ? 'Creating...' : 'Create ticket'}
          </Button>
        </AppActions>
      </form>
      </DialogContent>
    </Dialog>
  );
}
