'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import UserForm from './UserForm';

export default function TeamView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState('');

  async function fetchUsers() {
    const res = await apiFetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
  }

  useEffect(() => {
    fetchUsers();
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

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.username}?`)) return;
    setError('');
    setUpdatingUserId(user.id);
    const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json();
    setUpdatingUserId(null);
    if (!res.ok) {
      setError(data.error || 'Failed to delete user.');
      return;
    }
    setUsers((prev) => prev.filter((existing) => existing.id !== user.id));
  }

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
              <th>Joined</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
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
            ))}
            {!users.length && <tr><td colSpan={isAdmin ? 4 : 3}><div className="empty">No users</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
