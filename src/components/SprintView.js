'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

function SprintCard({ sprint, isAdmin, onAction }) {
  return (
    <div className="sprint-card">
      <div className="sprint-card-header">
        <span className="sprint-card-name">{sprint.name}</span>
        <span className={`sprint-status sprint-status-${sprint.status}`}>{sprint.status}</span>
      </div>
      <div className="sprint-dates">{sprint.start_date} - {sprint.end_date}</div>
      <div className="sprint-progress">
        {sprint.status === 'completed'
          ? `${sprint.done_count}/${sprint.ticket_count} done`
          : `${sprint.ticket_count} tickets - ${sprint.done_count} done`}
      </div>
      {isAdmin && (
        <div className="mt-lg flex gap-md">
          {sprint.status === 'planning' && (
            <>
              <button className="btn btn-sm btn-primary" onClick={() => onAction('start', sprint.id)}>Start Sprint</button>
              <button className="btn btn-sm btn-danger" onClick={() => onAction('delete', sprint.id)}>Delete</button>
            </>
          )}
          {sprint.status === 'active' && (
            <button className="btn btn-sm" onClick={() => onAction('complete', sprint.id)}>Complete Sprint</button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateSprintForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

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
    const res = await apiFetch('/api/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to create sprint.');
    onCreated(data.sprint);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-lg">
      <h3 className="mb-lg">New Sprint</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="sprint-name">Name</label>
          <input id="sprint-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="sprint-start">Start Date</label>
            <button type="button" className="btn btn-sm" onClick={() => setStartDate(dateFromToday(0))}>Today</button>
          </div>
          <input id="sprint-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="sprint-end">End Date</label>
            <div className="flex gap-sm">
              <button type="button" className="btn btn-sm" onClick={() => setEndDate(dateFromToday(7))}>+1 week</button>
              <button type="button" className="btn btn-sm" onClick={() => setEndDate(dateFromToday(14))}>+2 weeks</button>
            </div>
          </div>
          <input id="sprint-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="flex gap-md">
        <button type="submit" className="btn btn-primary btn-sm">Create</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function SprintView({ currentUser }) {
  const [sprints, setSprints] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

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
    } else if (action === 'complete') {
      if (!confirm('Complete this sprint? Unfinished tickets will move to backlog.')) return;
      await apiFetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
    } else if (action === 'delete') {
      if (!confirm('Delete this sprint? Tickets will be unassigned.')) return;
      await apiFetch(`/api/sprints/${sprintId}`, { method: 'DELETE' });
    }
    fetchSprints();
  }

  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { active: 0, planning: 1, completed: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.start_date) - new Date(a.start_date);
  });
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sprints</h1>
        {isAdmin && <button className="btn btn-sm" onClick={() => setShowCreateForm(true)}>+ New Sprint</button>}
      </div>
      {showCreateForm && (
        <CreateSprintForm
          onCreated={() => {
            setShowCreateForm(false);
            fetchSprints();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
      {sortedSprints.map((sprint) => (
        <SprintCard key={sprint.id} sprint={sprint} isAdmin={isAdmin} onAction={handleAction} />
      ))}
      {!sortedSprints.length && <div className="empty">No sprints</div>}
    </div>
  );
}
