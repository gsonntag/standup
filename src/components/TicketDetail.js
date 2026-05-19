'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { uploadPastedImage } from '@/lib/description-paste';
import CommentThread from './CommentThread';
import DescriptionPreview from './DescriptionPreview';
import DependencyPicker from './DependencyPicker';
import ImageUploadButton from './ImageUploadButton';
import LabelPicker from './LabelPicker';

export default function TicketDetail({ ticketId, initialEditing = false, onClose }) {
  const [activeTicketId, setActiveTicketId] = useState(ticketId);
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);

  async function fetchTicket() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}`);
    const data = await res.json();
    if (data.ticket) {
      setTicket(data.ticket);
      setTitle(data.ticket.title);
      setDescription(data.ticket.description);
    }
  }

  async function fetchComments() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
  }

  useEffect(() => {
    setActiveTicketId(ticketId);
    setIsEditing(initialEditing);
  }, [ticketId, initialEditing]);

  useEffect(() => {
    fetchTicket();
    fetchComments();
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
  }, [activeTicketId]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose({ updated: true });
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  async function updateField(field, value) {
    const nextValue = ['sprint_id', 'assignee_id'].includes(field) ? value || null : value;
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: nextValue }),
    });
    if (res.ok) {
      fetchTicket();
      fetchComments();
    }
  }

  async function finishEditing() {
    await updateField('title', title);
    await updateField('description', description);
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
                onBlur={() => updateField('title', title)}
              />
            ) : (
              <span className="detail-title-view">{ticket.title}</span>
            )}
          </h2>
          {isEditing ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={finishEditing}>Done</button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => setIsEditing(true)}>Edit</button>
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
                      onBlur={() => updateField('description', description)}
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
                  onAdded={(comment) => setComments((prev) => [...prev, comment])}
                />
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
                {isEditing ? (
                  <select id="detail-sprint" value={ticket.sprint_id || ''} onChange={(e) => updateField('sprint_id', e.target.value)}>
                    <option value="">No sprint (backlog)</option>
                    {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="detail-value">{sprintName}</div>
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
              {isEditing && <button type="button" className="btn btn-danger btn-sm" onClick={deleteTicket}>Delete ticket</button>}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
