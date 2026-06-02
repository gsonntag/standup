'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { MAX_USERNAME_LENGTH } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircleIcon, UserCirclePlusIcon } from '@phosphor-icons/react';
import { AppActions, AppField } from './AppUI';

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
      <Card className="team-form-card ds-card">
        <CardHeader><span className="ds-section-icon"><CheckCircleIcon weight="bold" /></span><CardTitle>User created</CardTitle></CardHeader>
        <CardContent className="team-form-content">
          <p className="text-sm">
            Share this temporary password with <span className="font-bold">{created.username}</span>.
            They&apos;ll be prompted to set a new one when they log in.
          </p>
          <div className="team-temp-password">
            <span>Temporary password</span>
            <strong className="text-mono">{created.tempPassword}</strong>
          </div>
          <Button type="button" size="sm" className="tickets-new-button" onClick={onCancel}>Done</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="team-form-card ds-card">
      <CardHeader><span className="ds-section-icon"><UserCirclePlusIcon weight="bold" /></span><CardTitle>Add user</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="team-inline-form">
          <AppField id="new-username" label="Username" icon={UserCirclePlusIcon}>
            <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={MAX_USERNAME_LENGTH} autoFocus placeholder="lowercase, max 8 chars" />
          </AppField>
          <p className="text-muted text-sm">A temporary password will be generated automatically.</p>
          {error && <div className="form-error">{error}</div>}
          <AppActions className="team-action-row">
            <Button type="submit" size="sm" className="tickets-new-button" disabled={loading}><UserCirclePlusIcon weight="bold" />{loading ? 'Creating...' : 'Create'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          </AppActions>
        </form>
      </CardContent>
    </Card>
  );
}
