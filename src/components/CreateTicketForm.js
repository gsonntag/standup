'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, TICKET_TEMPLATE } from '@/lib/constants';
import { uploadPastedImage } from '@/lib/description-paste';
import DescriptionPreview from './DescriptionPreview';
import ImageUploadButton from './ImageUploadButton';

export default function CreateTicketForm({ users, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(TICKET_TEMPLATE);
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const spParsed = storyPoints !== '' ? parseInt(storyPoints, 10) : null;
    const res = await apiFetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        priority,
        assignee_id: assigneeId || null,
        ...(spParsed != null && spParsed > 0 ? { story_points: spParsed } : {}),
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
    uploadPastedImage(e, (markdown) => insertDescriptionImage(markdown, e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="mb-lg">
      <h3 className="mb-lg">New Ticket</h3>
      <div className="form-group">
        <label htmlFor="ticket-title">Title</label>
        <input
          id="ticket-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ticket-priority">Priority</label>
          <select id="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ticket-assignee">Assignee</label>
          <select id="ticket-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ticket-story-points">Points</label>
          <input
            id="ticket-story-points"
            type="number"
            min="1"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
            placeholder="—"
            style={{ width: '80px' }}
          />
        </div>
      </div>
      <div className="form-group">
        <div className="flex-between mb-md">
          <label htmlFor="ticket-description">Description</label>
          <ImageUploadButton onUploaded={appendDescriptionImage} />
        </div>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onPaste={handleDescriptionPaste}
          rows={14}
        />
        <DescriptionPreview value={description} />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="flex gap-md">
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
