'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { MAX_USERNAME_LENGTH } from '@/lib/constants';

export default function UserForm({ onCreated, onCancel }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username) return setError('Username is required.');
    if (username !== username.toLowerCase()) return setError('Username must be lowercase.');
    if (username.length > MAX_USERNAME_LENGTH) return setError(`Username must be ${MAX_USERNAME_LENGTH} chars or fewer.`);
    if (!/^[a-z][a-z0-9]*$/.test(username)) return setError('Username must start with a letter, letters and numbers only.');

    setLoading(true);
    const res = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || 'Failed to create user.');
    onCreated(data.user);
    setCreated({ username: data.user.username, tempPassword: data.temp_password });
  }

  if (created) {
    return (
      <div className="mb-lg">
        <h3 className="mb-md">User created</h3>
        <p className="text-sm">
          Share this temporary password with <span className="font-bold">{created.username}</span>.
          They&apos;ll be prompted to set a new one when they log in.
        </p>
        <p className="mb-lg">
          Temporary password: <span className="text-mono font-bold" style={{ fontSize: '1.1rem' }}>{created.tempPassword}</span>
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={onCancel}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-lg">
      <h3 className="mb-lg">Add User</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="new-username">Username</label>
          <input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={MAX_USERNAME_LENGTH} autoFocus placeholder="lowercase, max 8 chars" />
        </div>
      </div>
      <p className="text-muted text-sm mb-md">A temporary password will be generated automatically.</p>
      {error && <div className="form-error">{error}</div>}
      <div className="flex gap-md">
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
