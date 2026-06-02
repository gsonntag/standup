'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChartBarIcon,
  DiscordLogoIcon,
  GithubLogoIcon,
  KeyIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCirclePlusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import AppPageHeader from './AppPageHeader';
import { AppActions, AppField } from './AppUI';
import UserForm from './UserForm';

export default function TeamView({ currentUser }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState('');
  const [editingDiscord, setEditingDiscord] = useState(null);
  const [discordInput, setDiscordInput] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [repoInput, setRepoInput] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [showSelfPwForm, setShowSelfPwForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const mustChange = !!currentUser?.must_change_password;

  async function submitPasswordChange(e, forced) {
    e.preventDefault();
    setPwError('');
    if (pwNew.length < MIN_PASSWORD_LENGTH) {
      return setPwError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (pwNew !== pwConfirm) return setPwError('Passwords do not match.');
    setPwLoading(true);
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forced ? { new_password: pwNew } : { current_password: pwCurrent, new_password: pwNew }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (!res.ok) return setPwError(data.error || 'Failed to change password.');
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    if (forced) {
      router.refresh();
    } else {
      setShowSelfPwForm(false);
    }
  }

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

  async function resetPassword(user) {
    if (!window.confirm(`Reset ${user.username}'s password? Their current password will stop working.`)) return;
    setError('');
    setResetResult(null);
    setUpdatingUserId(user.id);
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_password: true }),
    });
    const data = await res.json();
    setUpdatingUserId(null);
    if (!res.ok) {
      setError(data.error || 'Failed to reset password.');
      return;
    }
    setUsers((prev) => prev.map((u) => u.id === user.id ? data.user : u));
    setResetResult({ username: user.username, tempPassword: data.temp_password });
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

  if (mustChange) {
    return (
      <div className="page">
        <div className="page-header"><h1>Set a new password</h1></div>
        <p className="text-muted mb-lg">You&apos;re using a temporary password. Choose a new one to continue.</p>
        <form onSubmit={(e) => submitPasswordChange(e, true)} className="team-password-card">
          <AppField id="forced-new" label="New password" icon={KeyIcon}>
            <Input id="forced-new" type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" autoFocus />
          </AppField>
          <AppField id="forced-confirm" label="Confirm password" icon={KeyIcon}>
            <Input id="forced-confirm" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </AppField>
          {pwError && <div className="form-error">{pwError}</div>}
          <Button type="submit" className="tickets-new-button" disabled={pwLoading}>{pwLoading ? 'Saving...' : 'Set password'}</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <AppPageHeader
        icon={UsersThreeIcon}
        eyebrow="Workspace"
        title="Team"
        subtitle="Manage LA Hacks tech accounts, Discord pings, and GitHub repositories."
        actions={(
          <div className="team-header-actions">
            <Button asChild size="sm" variant="outline">
              <a href="/dashboard">
                <ChartBarIcon weight="bold" />
                Public dashboard
              </a>
            </Button>
            {isAdmin && (
              <Button size="sm" className="tickets-new-button" onClick={() => setShowForm(true)}>
                <UserCirclePlusIcon weight="bold" />
                Add user
              </Button>
            )}
          </div>
        )}
      />
      {showForm && (
        <UserForm
          onCreated={(newUser) => {
            setUsers((prev) => [...prev, newUser].sort((a, b) => a.username.localeCompare(b.username)));
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {error && <div className="form-error">{error}</div>}
      {resetResult && (
        <Card className="team-notice-card">
          <CardContent>
            <span>Temporary password for <strong>{resetResult.username}</strong></span>
            <strong className="text-mono">{resetResult.tempPassword}</strong>
            <span>They&apos;ll set a new one at next login.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setResetResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}
      {showSelfPwForm && (
        <Card className="team-form-card">
        <CardHeader><CardTitle>Change your password</CardTitle></CardHeader>
        <CardContent>
        <form onSubmit={(e) => submitPasswordChange(e, false)} className="team-inline-form">
          <AppField id="self-current" label="Current password" icon={KeyIcon}>
            <Input id="self-current" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" autoFocus />
          </AppField>
          <AppField id="self-new" label="New password" icon={KeyIcon}>
            <Input id="self-new" type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" />
          </AppField>
          <AppField id="self-confirm" label="Confirm password" icon={KeyIcon}>
            <Input id="self-confirm" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </AppField>
          {pwError && <div className="form-error">{pwError}</div>}
          <AppActions className="team-action-row">
            <Button type="submit" size="sm" className="tickets-new-button" disabled={pwLoading}>{pwLoading ? 'Saving...' : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowSelfPwForm(false); setPwError(''); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }}>Cancel</Button>
          </AppActions>
        </form>
        </CardContent>
        </Card>
      )}
      <Card className="team-table-card ds-card">
        <CardHeader>
          <span className="ds-section-icon"><UsersThreeIcon weight="bold" /></span>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
        <Table className="team-table">
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Discord</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const canEditDiscord = isAdmin || user.id === currentUser?.id;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-bold">
                    <span className="ds-person-cell"><span className="ds-avatar">{user.username.slice(0, 2)}</span>{user.username}</span>
                  </TableCell>
                  <TableCell>
                    {isAdmin && user.id !== currentUser?.id ? (
                      <Select value={user.role} disabled={updatingUserId === user.id} onValueChange={(role) => updateRole(user.id, role)}>
                        <SelectTrigger className="team-role-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">member</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className="ds-role-badge" variant="outline"><ShieldCheckIcon weight="bold" />{user.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingDiscord === user.id ? (
                      <span className="team-inline-edit">
                        <Input
                          className="team-discord-input"
                          value={discordInput}
                          onChange={(e) => setDiscordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveDiscord(user.id);
                            if (e.key === 'Escape') setEditingDiscord(null);
                          }}
                          autoFocus
                          placeholder="user ID (e.g. 204255221017214977)"
                          title="Numeric Discord user ID — required for @-mention pings. In Discord: User Settings → Advanced → Developer Mode, then right-click a user → Copy User ID."
                        />
                        <Button type="button" size="sm" className="tickets-new-button" onClick={() => saveDiscord(user.id)}>Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingDiscord(null)}>Cancel</Button>
                      </span>
                    ) : (
                      <span className="team-inline-edit">
                        <span className="team-discord-value"><DiscordLogoIcon weight="bold" />{user.discord_id || <em>not set</em>}</span>
                        {canEditDiscord && (
                          <Button type="button" size="sm" variant="outline" onClick={() => startEditDiscord(user)}>
                            <PencilSimpleIcon weight="bold" />
                            {user.discord_id ? 'Edit' : 'Set'}
                          </Button>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted text-sm">{user.created_at?.split(' ')[0]?.split('T')[0]}</TableCell>
                  <TableCell>
                    <span className="team-action-row">
                      {user.id === currentUser?.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => { setShowSelfPwForm(true); setPwError(''); }}
                        >
                          <KeyIcon weight="bold" />
                          Change password
                        </Button>
                      )}
                      {isAdmin && user.id !== currentUser?.id && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updatingUserId === user.id}
                            onClick={() => resetPassword(user)}
                          >
                            <KeyIcon weight="bold" />
                            Reset password
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={updatingUserId === user.id}
                            onClick={() => deleteUser(user)}
                          >
                            <TrashIcon weight="bold" />
                            Delete
                          </Button>
                        </>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {!users.length && <TableRow><TableCell colSpan={5}><div className="empty">No users</div></TableCell></TableRow>}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
      {users.length <= 1 && (
        <div className="empty team-empty-note">
          {isAdmin
            ? "You're the only user here. Add team members with + Add User above."
            : "You're the only user here. Ask an admin to add team members."}
        </div>
      )}
      <AppPageHeader
        className="team-section-header"
        icon={GithubLogoIcon}
        eyebrow="Integrations"
        title="GitHub Repositories"
        subtitle="Repositories available for ticket linking and commit activity."
      />
      {isAdmin && (
        <Card className="team-form-card ds-card">
          <CardContent>
          <form onSubmit={addRepository} className="team-repo-form">
          <AppField id="github-repository" label="Repository" icon={GithubLogoIcon}>
            <Input
              id="github-repository"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/name"
              required
            />
          </AppField>
          <AppActions className="team-repo-submit">
            <Button type="submit" size="sm" className="tickets-new-button" disabled={repoLoading}>
              <PlusIcon weight="bold" />
              {repoLoading ? 'Adding...' : 'Add repository'}
            </Button>
          </AppActions>
        </form>
          </CardContent>
        </Card>
      )}
      <Card className="team-table-card ds-card">
        <CardContent>
        <Table className="team-table">
          <TableHeader>
            <TableRow>
              <TableHead>Repository</TableHead>
              <TableHead>Default Branch</TableHead>
              <TableHead>Updated</TableHead>
              {isAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {repositories.map((repo) => (
              <TableRow key={repo.id}>
                <TableCell className="font-bold">
                  <a className="team-repo-link" href={repo.html_url} target="_blank" rel="noopener noreferrer"><GithubLogoIcon weight="bold" />{repo.full_name}</a>
                </TableCell>
                <TableCell className="text-muted text-mono">{repo.default_branch}</TableCell>
                <TableCell className="text-muted text-sm">{repo.updated_at?.split(' ')[0]?.split('T')[0]}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button type="button" variant="destructive" size="sm" onClick={() => deleteRepository(repo)}>
                      Remove
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!repositories.length && (
              <TableRow><TableCell colSpan={isAdmin ? 4 : 3}><div className="empty">No repositories</div></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </div>
  );
}
