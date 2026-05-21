'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { parseTimestamp, timeAgo } from '@/lib/dates';
import { uploadPastedImage } from '@/lib/description-paste';
import CommentThread from './CommentThread';
import { useRealtime } from '@/lib/realtime';
import DescriptionPreview from './DescriptionPreview';
import DependencyPicker from './DependencyPicker';
import ImageUploadButton from './ImageUploadButton';
import LabelPicker from './LabelPicker';

export default function TicketDetail({ ticketId, initialEditing = false, onClose }) {
  const [activeTicketId, setActiveTicketId] = useState(ticketId);
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [totalPointsInput, setTotalPointsInput] = useState('');
  const [pointsRemainingInput, setPointsRemainingInput] = useState('');
  const attachFileRef = useRef(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [relatedCommits, setRelatedCommits] = useState([]);
  const [commitPickerOpen, setCommitPickerOpen] = useState(false);
  const [commitOptions, setCommitOptions] = useState([]);
  const [commitSearch, setCommitSearch] = useState('');
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitSyncing, setCommitSyncing] = useState(false);
  const [commitError, setCommitError] = useState('');

  async function fetchTicket() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}`);
    const data = await res.json();
    if (data.ticket) {
      setTicket(data.ticket);
      setTitle(data.ticket.title);
      setDescription(data.ticket.description);
      setEvents(data.ticket.events || []);
      setTotalPointsInput(data.ticket.total_points != null ? String(data.ticket.total_points) : '');
      setPointsRemainingInput(data.ticket.points_remaining != null ? String(data.ticket.points_remaining) : '');
    }
  }

  async function fetchComments() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
  }

  async function fetchRelatedCommits() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`);
    const data = await res.json();
    setRelatedCommits(data.commits || []);
  }

  async function fetchCurrentUser() {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user || null);
    }
  }

  useEffect(() => {
    setActiveTicketId(ticketId);
    setIsEditing(initialEditing);
  }, [ticketId, initialEditing]);

  useEffect(() => {
    fetchTicket();
    fetchComments();
    fetchRelatedCommits();
    fetchCurrentUser();
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
    apiFetch('/api/github/repositories').then((r) => r.json()).then((d) => setRepositories(d.repositories || []));
  }, [activeTicketId]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose({ updated: true });
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useRealtime((event) => {
    if (event.kind === 'ticket' && event.id === activeTicketId) fetchTicket();
    if (event.kind === 'comment' && event.ticket_id === activeTicketId) fetchComments();
  });

  function startEditing() {
    setOriginalTitle(title);
    setOriginalDescription(description);
    setIsEditing(true);
  }

  async function updateField(field, value) {
    const nextValue = ['sprint_id', 'assignee_id', 'github_repo_id'].includes(field) ? value || null : value;
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: nextValue }),
    });
    if (res.ok) {
      fetchTicket();
      fetchComments();
      if (field === 'github_repo_id') {
        setRelatedCommits([]);
        setCommitOptions([]);
        setCommitPickerOpen(false);
      }
    }
  }

  async function finishEditing() {
    const titleChanged = title !== originalTitle;
    const descriptionChanged = description !== originalDescription;

    if (titleChanged || descriptionChanged) {
      const patch = {};
      if (titleChanged) patch.title = title;
      if (descriptionChanged) patch.description = description;
      const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        fetchTicket();
        fetchComments();
      }
    }

    setIsEditing(false);
  }

  function cancelEditing() {
    setTitle(originalTitle);
    setDescription(originalDescription);
    setIsEditing(false);
  }

  async function appendDescriptionImage(markdown) {
    const nextDescription = `${description.trimEnd()}\n\n${markdown}\n`;
    setDescription(nextDescription);
    await updateField('description', nextDescription);
  }

  async function insertDescriptionImage(markdown, target) {
    const start = target?.selectionStart ?? description.length;
    const end = target?.selectionEnd ?? description.length;
    const prefix = description.slice(0, start).replace(/\s*$/, '\n\n');
    const suffix = description.slice(end).replace(/^\s*/, '\n');
    const nextDescription = `${prefix}${markdown}${suffix}`;
    setDescription(nextDescription);
    await updateField('description', nextDescription);
  }

  function handleDescriptionPaste(e) {
    uploadPastedImage(e, (markdown) => insertDescriptionImage(markdown, e.currentTarget));
  }

  async function removeDependency(dependsOnId) {
    await apiFetch(`/api/tickets/${activeTicketId}/dependencies`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_id: dependsOnId }),
    });
    fetchTicket();
  }

  async function deleteTicket() {
    if (!confirm('Delete this ticket?')) return;
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, { method: 'DELETE' });
    if (res.ok) onClose({ deleted: true });
  }

  async function toggleWatcher() {
    if (!currentUser) return;
    const isWatching = ticket.watchers?.some((w) => w.id === currentUser.id);
    if (isWatching) {
      await apiFetch(`/api/tickets/${activeTicketId}/watchers/${currentUser.id}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/tickets/${activeTicketId}/watchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    }
    fetchTicket();
  }

  async function handleAttachFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('ticket_id', activeTicketId);
      const res = await apiFetch('/api/uploads', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Upload failed.');
        return;
      }
      fetchTicket();
    } catch (err) {
      alert(err.message);
    } finally {
      setAttachUploading(false);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resolveEventValue(field, value) {
    if (!value) return '(none)';
    if (field === 'assignee') {
      return users.find((u) => u.id === value)?.username || value;
    }
    if (field === 'sprint') {
      return sprints.find((s) => s.id === value)?.name || value;
    }
    if (field === 'repository') {
      const repo = repositories.find((r) => r.id === value);
      return repo ? repo.full_name : value;
    }
    return value;
  }

  async function fetchCommitOptions(search = commitSearch) {
    if (!ticket.github_repo_id) return;
    setCommitError('');
    setCommitLoading(true);
    const params = new URLSearchParams({ ticket_id: activeTicketId, limit: '100' });
    if (search) params.set('q', search);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/commits?${params.toString()}`);
    const data = await res.json();
    setCommitLoading(false);
    if (!res.ok) {
      setCommitError(data.error || 'Failed to load commits.');
      return;
    }
    setCommitOptions(data.commits || []);
  }

  async function syncCommits() {
    if (!ticket.github_repo_id) return;
    setCommitError('');
    setCommitSyncing(true);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/sync-commits`, { method: 'POST' });
    const data = await res.json();
    setCommitSyncing(false);
    if (!res.ok) {
      setCommitError(data.error || 'Failed to refresh commits.');
      return;
    }
    fetchCommitOptions();
  }

  async function linkCommit(sha) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCommitError(data.error || 'Failed to link commit.');
      return;
    }
    setRelatedCommits(data.commits || []);
    fetchCommitOptions();
  }

  async function unlinkCommit(sha) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    });
    if (res.ok) {
      setRelatedCommits((prev) => prev.filter((commit) => commit.sha !== sha));
      fetchCommitOptions();
    }
  }

  function firstLine(message) {
    return (message || '').split('\n')[0];
  }

  function branchText(commit) {
    const branches = commit.branches || [];
    if (!branches.length) return '';
    if (branches.length <= 2) return branches.join(', ');
    return `${branches.slice(0, 2).join(', ')} +${branches.length - 2}`;
  }

  if (!ticket) {
    return (
      <div className="modal-overlay" onClick={() => onClose()}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">Loading...</div>
        </div>
      </div>
    );
  }

  const assigneeName = ticket.assignee_username || 'Unassigned';
  const sprintName = ticket.sprint_id
    ? sprints.find((sprint) => sprint.id === ticket.sprint_id)?.name || 'Current sprint'
    : 'No sprint';

  // Merge events and comments for the activity section
  const activityItems = [
    ...events.map((e) => ({ ...e, _type: 'event' })),
    ...comments.map((c) => ({ ...c, _type: 'comment' })),
  ].sort((a, b) => parseTimestamp(a.created_at) - parseTimestamp(b.created_at));

  return (
    <div className="modal-overlay" onClick={() => onClose({ updated: true })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="flex gap-md" style={{ flex: 1 }}>
            <span className="text-mono text-muted">#{ticket.number}</span>
            {isEditing ? (
              <input
                className="detail-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <span className="detail-title-view">{ticket.title}</span>
            )}
          </h2>
          {isEditing ? (
            <div className="flex gap-sm">
              <button type="button" className="btn btn-primary btn-sm" onClick={finishEditing}>Done</button>
              <button type="button" className="btn btn-sm" onClick={cancelEditing}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="btn btn-sm" onClick={startEditing}>Edit</button>
          )}
          <button type="button" className="modal-close" onClick={() => onClose({ updated: true })}>x</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-main">
              <div className="detail-field">
                <div className="flex-between mb-md">
                  <div className="detail-field-label">Description</div>
                  {isEditing && <ImageUploadButton onUploaded={appendDescriptionImage} />}
                </div>
                {isEditing ? (
                  <>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onPaste={handleDescriptionPaste}
                      rows={14}
                    />
                    <DescriptionPreview value={description} />
                  </>
                ) : (
                  <DescriptionPreview value={ticket.description || ''} />
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Comments</div>
                <CommentThread
                  ticketId={activeTicketId}
                  comments={comments}
                  currentUser={currentUser}
                  users={users}
                  onAdded={(comment) => setComments((prev) => [...prev, comment])}
                  onDeleted={(commentId) =>
                    setComments((prev) =>
                      prev.map((c) =>
                        c.id === commentId
                          ? { ...c, deleted_at: new Date().toISOString(), deleted_by_username: currentUser?.username }
                          : c
                      )
                    )
                  }
                />
              </div>
              <div className="detail-field">
                <div className="flex-between mb-md">
                  <div className="detail-field-label">Related commits</div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!ticket.github_repo_id}
                    onClick={() => {
                      const nextOpen = !commitPickerOpen;
                      setCommitPickerOpen(nextOpen);
                      if (nextOpen) fetchCommitOptions();
                    }}
                  >
                    Link commits
                  </button>
                </div>
                {!ticket.github_repo_id && <div className="empty compact-empty">Select a repository before linking commits.</div>}
                {ticket.github_repo_id && relatedCommits.length === 0 && <div className="empty compact-empty">No commits linked</div>}
                {relatedCommits.length > 0 && (
                  <ul className="commit-list">
                    {relatedCommits.map((commit) => (
                      <li className="commit-row" key={commit.sha}>
                        <div className="commit-main">
                          <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="text-mono">{commit.short_sha}</a>
                          <span>{firstLine(commit.message)}</span>
                          <span className="text-muted text-sm">{commit.author_login || commit.author_name || 'unknown'} · {timeAgo(commit.committed_at)}</span>
                          {branchText(commit) && <span className="text-muted text-sm">{branchText(commit)}</span>}
                        </div>
                        <button type="button" className="btn btn-sm" onClick={() => unlinkCommit(commit.sha)}>Unlink</button>
                      </li>
                    ))}
                  </ul>
                )}
                {commitPickerOpen && ticket.github_repo_id && (
                  <div className="label-picker-dropdown commit-picker">
                    <div className="flex gap-sm mb-md">
                      <input
                        type="search"
                        value={commitSearch}
                        onChange={(e) => setCommitSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') fetchCommitOptions(commitSearch);
                        }}
                        placeholder="Search commits"
                      />
                      <button type="button" className="btn btn-sm" onClick={() => fetchCommitOptions(commitSearch)} disabled={commitLoading}>Search</button>
                      <button type="button" className="btn btn-sm" onClick={syncCommits} disabled={commitSyncing}>
                        {commitSyncing ? 'Refreshing...' : 'Refresh from GitHub'}
                      </button>
                    </div>
                    {commitError && <div className="form-error">{commitError}</div>}
                    {commitLoading && <div className="empty compact-empty">Loading commits...</div>}
                    {!commitLoading && commitOptions.length === 0 && <div className="empty compact-empty">No cached commits</div>}
                    {!commitLoading && commitOptions.length > 0 && (
                      <ul className="commit-list">
                        {commitOptions.map((commit) => (
                          <li className="commit-row" key={commit.sha}>
                            <div className="commit-main">
                              <span className="text-mono">{commit.short_sha}</span>
                              <span>{firstLine(commit.message)}</span>
                              <span className="text-muted text-sm">{commit.author_login || commit.author_name || 'unknown'} · {timeAgo(commit.committed_at)}</span>
                              {branchText(commit) && <span className="text-muted text-sm">{branchText(commit)}</span>}
                            </div>
                            <button type="button" className="btn btn-sm" disabled={commit.linked} onClick={() => linkCommit(commit.sha)}>
                              {commit.linked ? 'Linked' : 'Link'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Activity</div>
                {activityItems.map((item) => {
                  if (item._type === 'event' && item.kind === 'field_change') {
                    return (
                      <div className="event-row" key={item.id}>
                        <span className="text-muted">
                          {item.actor_username} changed {item.field}{item.field !== 'description' && <>: {resolveEventValue(item.field, item.old_value)} → {resolveEventValue(item.field, item.new_value)}</>}
                        </span>
                        <span className="text-muted comment-date">{timeAgo(item.created_at)}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
            <aside className="detail-sidebar">
              <div className="detail-field">
                <div className="detail-field-label">Created by</div>
                <div className="detail-value">{ticket.creator_username}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Status</div>
                {isEditing ? (
                  <select id="detail-status" value={ticket.status} onChange={(e) => updateField('status', e.target.value)}>
                    {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                ) : (
                  <div className="detail-value">{ticket.status}</div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Priority</div>
                {isEditing ? (
                  <select id="detail-priority" value={ticket.priority} onChange={(e) => updateField('priority', e.target.value)}>
                    {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                ) : (
                  <span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Total Points</div>
                <input
                  type="number"
                  min="1"
                  style={{ width: '80px' }}
                  value={totalPointsInput}
                  onChange={(e) => setTotalPointsInput(e.target.value)}
                  onBlur={() => {
                    const val = totalPointsInput === '' ? null : parseInt(totalPointsInput, 10);
                    if (totalPointsInput !== '' && (isNaN(val) || val < 1)) return;
                    const current = ticket.total_points ?? null;
                    if (val !== current) updateField('total_points', val);
                  }}
                  placeholder="—"
                />
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Points Remaining</div>
                <input
                  type="number"
                  min="0"
                  style={{ width: '80px' }}
                  value={pointsRemainingInput}
                  onChange={(e) => setPointsRemainingInput(e.target.value)}
                  onBlur={() => {
                    const val = pointsRemainingInput === '' ? null : parseInt(pointsRemainingInput, 10);
                    if (pointsRemainingInput !== '' && (isNaN(val) || val < 0)) return;
                    const current = ticket.points_remaining ?? null;
                    if (val !== current) updateField('points_remaining', val);
                  }}
                  placeholder="—"
                />
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Due Date</div>
                <input
                  type="date"
                  value={ticket.due_date || ''}
                  onChange={(e) => updateField('due_date', e.target.value || null)}
                />
                {ticket.sprint_id && sprints.find(s => s.id === ticket.sprint_id)?.end_date && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => updateField('due_date', sprints.find(s => s.id === ticket.sprint_id).end_date)}
                  >End of Sprint</button>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Assignee</div>
                {isEditing ? (
                  <select id="detail-assignee" value={ticket.assignee_id || ''} onChange={(e) => updateField('assignee_id', e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                  </select>
                ) : (
                  <div className="detail-value">{assigneeName}</div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Sprint</div>
                <select id="detail-sprint" value={ticket.sprint_id || ''} onChange={(e) => updateField('sprint_id', e.target.value)}>
                  <option value="">Backlog</option>
                  {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                  ))}
                </select>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Repository</div>
                {isEditing ? (
                  <select id="detail-github-repo" value={ticket.github_repo_id || ''} onChange={(e) => updateField('github_repo_id', e.target.value)}>
                    <option value="">No repository</option>
                    {repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
                  </select>
                ) : ticket.github_repository ? (
                  <a href={ticket.github_repository.html_url} target="_blank" rel="noopener noreferrer" className="detail-value">
                    {ticket.github_repository.owner}/{ticket.github_repository.name}
                  </a>
                ) : (
                  <div className="detail-value">No repository</div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Labels</div>
                {isEditing ? (
                  <LabelPicker ticketId={activeTicketId} currentLabels={ticket.labels || []} onUpdate={fetchTicket} />
                ) : (
                  <span className="label-list">
                    {ticket.labels?.map((label) => (
                      <span key={label.id} className="label" style={{ backgroundColor: label.color }}>{label.name}</span>
                    ))}
                    {!ticket.labels?.length && <span className="detail-value">None</span>}
                  </span>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Blocked by</div>
                <ul className="dep-list">
                  {ticket.blockers?.map((blocker) => (
                    <li className="dep-item" key={blocker.id}>
                      <span className={blocker.status === 'done' ? 'dep-status-done' : 'dep-status-pending'}>
                        {blocker.status === 'done' ? 'done' : 'open'}
                      </span>
                      <button type="button" className="label-picker-item" onClick={() => setActiveTicketId(blocker.id)}>
                        #{blocker.number} {blocker.title}
                      </button>
                      {isEditing && <button type="button" className="dep-remove" onClick={() => removeDependency(blocker.id)}>x</button>}
                    </li>
                  ))}
                </ul>
                {isEditing && <button type="button" className="btn btn-sm mt-md" onClick={() => setShowDependencyPicker((value) => !value)}>+ add blocker</button>}
                {isEditing && showDependencyPicker && (
                  <DependencyPicker
                    ticketId={activeTicketId}
                    blockers={ticket.blockers || []}
                    onAdded={() => {
                      setShowDependencyPicker(false);
                      fetchTicket();
                    }}
                  />
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Unblocks</div>
                <ul className="dep-list">
                  {ticket.unblocks?.map((item) => (
                    <li className="dep-item" key={item.id}>
                      <button type="button" className="label-picker-item" onClick={() => setActiveTicketId(item.id)}>
                        #{item.number} {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Watchers</div>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: '4px' }}>
                  {ticket.watchers?.map((w) => (
                    <span key={w.id} className="label" style={{ backgroundColor: 'var(--text-muted)' }}>@{w.username}</span>
                  ))}
                  {!ticket.watchers?.length && <span className="detail-value">None</span>}
                </div>
                {currentUser && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={toggleWatcher}
                  >
                    {ticket.watchers?.some((w) => w.id === currentUser.id) ? 'Unwatch' : 'Watch'}
                  </button>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Attachments</div>
                {ticket.attachments?.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px 0' }}>
                    {ticket.attachments.map((att) => (
                      <li key={att.id} style={{ marginBottom: '4px' }}>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="label-picker-item">
                          {att.filename}
                        </a>
                        <span className="text-muted" style={{ marginLeft: '4px', fontSize: '0.75em' }}>
                          ({formatBytes(att.size_bytes)})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={attachFileRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleAttachFile}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={attachUploading}
                  onClick={() => attachFileRef.current?.click()}
                >
                  {attachUploading ? 'Uploading...' : 'Attach file'}
                </button>
              </div>
              {isEditing && (currentUser?.role === 'admin' || ticket?.creator_id === currentUser?.id) && (
                <button type="button" className="btn btn-danger btn-sm" onClick={deleteTicket}>Delete ticket</button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
