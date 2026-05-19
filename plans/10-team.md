# Phase 10: Team Page

## Goal

Build the team page at `/team`. Shows all users. Admins see a button to create new users.

---

## Component: `src/app/team/page.js`

```js
import { getCurrentUser } from '@/lib/auth';
import TeamView from '@/components/TeamView';

export default async function TeamPage() {
  const user = await getCurrentUser();
  return <TeamView currentUser={user} />;
}
```

## Component: `src/components/TeamView.js` — Client Component

### State
```js
const [users, setUsers] = useState([]);
const [showForm, setShowForm] = useState(false);
const [error, setError] = useState('');
```

### Data Fetching
```js
useEffect(() => { fetchUsers(); }, []);

async function fetchUsers() {
  const res = await fetch('/api/users');
  const data = await res.json();
  setUsers(data.users);
}
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Team                               [+ Add User]   │
├─────────────────────────────────────────────────────┤
│  USERNAME    │ ROLE     │ JOINED                    │
│  admin       │ admin    │ 2026-05-19                │
│  gavin       │ member   │ 2026-05-19                │
│  alice       │ member   │ 2026-05-19                │
└─────────────────────────────────────────────────────┘
```

### Table

Uses `.table-container` and `<table>` classes from the design system.

```js
<div className="table-container">
  <table>
    <thead>
      <tr>
        <th>Username</th>
        <th>Role</th>
        <th>Joined</th>
      </tr>
    </thead>
    <tbody>
      {users.map(user => (
        <tr key={user.id}>
          <td className="font-bold">{user.username}</td>
          <td className="text-muted">{user.role}</td>
          <td className="text-muted text-sm">{user.created_at?.split('T')[0]}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Add User Form (Admin Only)

The "+ Add User" button is only visible when `currentUser.role === 'admin'`.

When clicked, shows a form inline above the table:

```
┌─────────────────────────────────────────┐
│  Add User                               │
│  USERNAME   [________]  (lowercase, max 8 chars)
│  PASSWORD   [________]                  │
│  [Create]  [Cancel]                     │
└─────────────────────────────────────────┘
```

**Component**: `src/components/UserForm.js`

```js
'use client';

import { useState } from 'react';
import { MAX_USERNAME_LENGTH } from '@/lib/constants';

export default function UserForm({ onCreated, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!username) { setError('Username is required.'); return; }
    if (username !== username.toLowerCase()) { setError('Username must be lowercase.'); return; }
    if (username.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} chars or fewer.`);
      return;
    }
    if (!/^[a-z][a-z0-9]*$/.test(username)) {
      setError('Username must start with a letter, letters and numbers only.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create user.');
        setLoading(false);
        return;
      }

      onCreated(data.user);
    } catch {
      setError('Network error.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-lg)' }}>Add User</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="new-username">Username</label>
          <input id="new-username" type="text" value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={MAX_USERNAME_LENGTH} autoFocus placeholder="lowercase, max 8 chars" />
        </div>
        <div className="form-group">
          <label htmlFor="new-password">Password</label>
          <input id="new-password" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="min 4 chars" />
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="flex gap-md">
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
```

**Integration in TeamView**:
```js
{currentUser.role === 'admin' && (
  <button className="btn btn-sm" onClick={() => setShowForm(true)}>
    + Add User
  </button>
)}

{showForm && (
  <UserForm
    onCreated={(newUser) => {
      setUsers(prev => [...prev, newUser]);
      setShowForm(false);
    }}
    onCancel={() => setShowForm(false)}
  />
)}
```

## Verification

1. Visit `/team` → shows all users in a table
2. As non-admin → no "Add User" button visible
3. As admin → "Add User" button visible
4. Click "Add User" → form appears
5. Submit with invalid username (uppercase, too long, special chars) → validation error
6. Submit with valid data → user appears in table, form closes
7. Log out and log in with the new user → works

Phase 10 complete. Move to Phase 11.
