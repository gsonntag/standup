'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import UserForm from './UserForm';

export default function TeamView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState('');
  const [editingDiscord, setEditingDiscord] = useState(null);
  const [discordInput, setDiscordInput] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [repoInput, setRepoInput] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);

  async function fetchUsers() {
    const res = await apiFetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
  }

  async function fetchRepositories() {
    const res = await apiFetch('/api/github/repositories');
    const data = await res.json();
    setRepositories(data.repositories || []);
  }

  useEffect(() => {
    fetchUsers();
    fetchRepositories();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  async function updateRole(userId, role) {
    setError('');
    setUpdatingUserId(userId);
    const res = await apiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    setUpdatingUserId(null);
    if (!res.ok) {
      setError(data.error || 'Failed to update role.');
      return;
    }
    setUsers((prev) => prev.map((user) => user.id === userId ? data.user : user));
  }

  function startEditDiscord(user) {
    setEditingDiscord(user.id);
    setDiscordInput(user.discord_id || '');
  }

  async function saveDiscord(userId) {
    setError('');
    const res = await apiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discord_id: discordInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to update Discord ID.');
      return;
    }
    setUsers((prev) => prev.map((u) => u.id === userId ? data.user : u));
    setEditingDiscord(null);
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.username}?`)) return;
    setError('');
    setUpdatingUserId(user.id);
    const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    setUpdatingUserId(null);
    if (!res.ok) {
      setError(data.error || 'Failed to delete user.');
      return;
    }
    setUsers((prev) => prev.filter((existing) => existing.id !== user.id));
  }

  async function addRepository(e) {
    e.preventDefault();
    setError('');
    setRepoLoading(true);
    const res = await apiFetch('/api/github/repositories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: repoInput }),
    });
    const data = await res.json();
    setRepoLoading(false);
    if (!res.ok) {
      setError(data.error || 'Failed to add repository.');
      return;
    }
    setRepoInput('');
    setRepositories((prev) => {
      const next = prev.filter((repo) => repo.id !== data.repository.id);
      return [...next, data.repository].sort((a, b) => a.full_name.localeCompare(b.full_name));
    });
  }

  async function deleteRepository(repo) {
    if (!window.confirm(`Remove ${repo.full_name}?`)) return;
    setError('');
    const res = await apiFetch(`/api/github/repositories/${repo.id}`, { method: 'DELETE' });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      setError(data.error || 'Failed to remove repository.');
      return;
    }
    setRepositories((prev) => prev.filter((existing) => existing.id !== repo.id));
  }

  const colCount = isAdmin ? 5 : 4;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Team</h1>
        {isAdmin && <button className="btn btn-sm" onClick={() => setShowForm(true)}>+ Add User</button>}
      </div>
      {showForm && (
        <UserForm
          onCreated={(newUser) => {
            setUsers((prev) => [...prev, newUser].sort((a, b) => a.username.localeCompare(b.username)));
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {error && <div className="form-error">{error}</div>}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Discord</th>
              <th>Joined</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const canEditDiscord = isAdmin || user.id === currentUser?.id;
              return (
                <tr key={user.id}>
                  <td className="font-bold">{user.username}</td>
                  <td className="text-muted">
                    {isAdmin && user.id !== currentUser?.id ? (
                      <select
                        className="role-select"
                        value={user.role}
                        disabled={updatingUserId === user.id}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td>
                    {editingDiscord === user.id ? (
                      <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                        <input
                          style={{ width: '140px' }}
                          value={discordInput}
                          onChange={(e) => setDiscordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveDiscord(user.id);
                            if (e.key === 'Escape') setEditingDiscord(null);
                          }}
                          autoFocus
                          placeholder="username"
                        />
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => saveDiscord(user.id)}>Save</button>
                        <button type="button" className="btn btn-sm" onClick={() => setEditingDiscord(null)}>Cancel</button>
                      </span>
                    ) : (
                      <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                        <span className="text-muted text-sm">{user.discord_id || <em>not set</em>}</span>
                        {canEditDiscord && (
                          <button type="button" className="btn btn-sm" onClick={() => startEditDiscord(user)}>
                            {user.discord_id ? 'Edit' : 'Set'}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="text-muted text-sm">{user.created_at?.split(' ')[0]?.split('T')[0]}</td>
                  {isAdmin && (
                    <td>
                      {user.id !== currentUser?.id && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={updatingUserId === user.id}
                          onClick={() => deleteUser(user)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!users.length && <tr><td colSpan={colCount}><div className="empty">No users</div></td></tr>}
          </tbody>
        </table>
      </div>
      {users.length <= 1 && (
        <div className="empty" style={{ marginTop: '1rem' }}>
          {isAdmin
            ? "You're the only user here. Add team members with + Add User above."
            : "You're the only user here. Ask an admin to add team members."}
        </div>
      )}
      <div className="page-header mt-xl">
        <h2>GitHub Repositories</h2>
      </div>
      {isAdmin && (
        <form onSubmit={addRepository} className="form-row mb-lg">
          <div className="form-group" style={{ maxWidth: '320px' }}>
            <label htmlFor="github-repository">Repository</label>
            <input
              id="github-repository"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/name"
              required
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-sm" disabled={repoLoading}>
              {repoLoading ? 'Adding...' : '+ Add Repository'}
            </button>
          </div>
        </form>
      )}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Repository</th>
              <th>Default Branch</th>
              <th>Updated</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {repositories.map((repo) => (
              <tr key={repo.id}>
                <td className="font-bold">
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.full_name}</a>
                </td>
                <td className="text-muted text-mono">{repo.default_branch}</td>
                <td className="text-muted text-sm">{repo.updated_at?.split(' ')[0]?.split('T')[0]}</td>
                {isAdmin && (
                  <td>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRepository(repo)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!repositories.length && (
              <tr><td colSpan={isAdmin ? 4 : 3}><div className="empty">No repositories</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
