'use client';

import { useState, useEffect } from 'react';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Divider } from '@astryxdesign/core/Divider';
import { apiFetch } from '@/lib/client-api';
import { MIN_PASSWORD_LENGTH, MAX_USERNAME_LENGTH } from '@/lib/constants';

export default function TeamView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Member Modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [addUserError, setAddUserError] = useState('');
  const [createdUserNotice, setCreatedUserNotice] = useState(null);

  // Change Password Modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [isPwLoading, setIsPwLoading] = useState(false);

  // Reset User Password Modal (Admin)
  const [resetNotice, setResetNotice] = useState(null);

  // Discord ID Edit
  const [editingDiscordUser, setEditingDiscordUser] = useState(null);
  const [discordIdInput, setDiscordIdInput] = useState('');

  // Add GitHub Repo
  const [repoInput, setRepoInput] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  async function fetchUsers() {
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function fetchRepositories() {
    try {
      const res = await apiFetch('/api/github/repositories');
      const data = await res.json();
      setRepositories(data.repositories || []);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    }
  }

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRepositories()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  async function handleAddUser() {
    setAddUserError('');
    const u = newUsername.trim().toLowerCase();
    if (!u) {
      setAddUserError('Username is required.');
      return;
    }
    if (u.length > MAX_USERNAME_LENGTH) {
      setAddUserError(`Username must be ${MAX_USERNAME_LENGTH} chars or fewer.`);
      return;
    }
    if (!/^[a-z][a-z0-9]*$/.test(u)) {
      setAddUserError('Username must start with a letter and contain only letters and numbers.');
      return;
    }

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddUserError(data.error || 'Failed to create user.');
      } else {
        setCreatedUserNotice({ username: data.user.username, tempPassword: data.temp_password });
        setNewUsername('');
        fetchUsers();
      }
    } catch {
      setAddUserError('An unexpected error occurred.');
    }
  }

  async function handleRoleChange(user, newRole) {
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      fetchUsers();
    }
  }

  async function handleResetPassword(user) {
    if (!confirm(`Reset password for @${user.username}? A temporary password will be generated.`)) return;
    const res = await apiFetch(`/api/users/${user.id}/reset-password`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) {
      setResetNotice({ username: user.username, tempPassword: data.temp_password });
    } else {
      alert(data.error || 'Failed to reset password.');
    }
  }

  async function handleDeleteUser(user) {
    if (!confirm(`Are you sure you want to delete user @${user.username}? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete user.');
    }
  }

  async function handleSaveDiscord() {
    if (!editingDiscordUser) return;
    const res = await apiFetch(`/api/users/${editingDiscordUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discord_id: discordIdInput.trim() || null }),
    });
    if (res.ok) {
      setEditingDiscordUser(null);
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update Discord ID.');
    }
  }

  async function handleChangePassword() {
    setPwError('');
    setPwSuccess('');
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      setPwError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match.');
      return;
    }

    setIsPwLoading(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || 'Failed to change password.');
      } else {
        setPwSuccess('Password changed successfully.');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setTimeout(() => setShowPwModal(false), 1500);
      }
    } finally {
      setIsPwLoading(false);
    }
  }

  async function handleAddRepo() {
    if (!repoInput.trim()) return;
    setRepoLoading(true);
    try {
      const res = await apiFetch('/api/github/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoInput.trim() }),
      });
      if (res.ok) {
        setRepoInput('');
        fetchRepositories();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add repository.');
      }
    } finally {
      setRepoLoading(false);
    }
  }

  async function handleDeleteRepo(repoId) {
    if (!confirm('Remove this repository connection?')) return;
    const res = await apiFetch(`/api/github/repositories/${repoId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchRepositories();
    }
  }

  const tableColumns = [
    {
      key: 'username',
      header: 'Member',
      width: proportional(2),
      renderCell: (item) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={item.username} size="sm" />
          <VStack gap={0}>
            <Text weight="semibold">@{item.username}</Text>
            {item.id === currentUser?.id && (
              <Text size="xs" color="secondary">You</Text>
            )}
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: proportional(1),
      renderCell: (item) => {
        if (isAdmin && item.id !== currentUser?.id) {
          return (
            <Selector
              label="Role"
              isLabelHidden
              value={item.role}
              onChange={(val) => handleRoleChange(item, val)}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
              size="sm"
            />
          );
        }
        return (
          <Badge variant={item.role === 'admin' ? 'accent' : 'neutral'}>
            {item.role.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'discord_id',
      header: 'Discord ID',
      width: proportional(2),
      renderCell: (item) => {
        const canEdit = isAdmin || item.id === currentUser?.id;
        return (
          <HStack gap={2} vAlign="center">
            <Text size="sm" color={item.discord_id ? 'primary' : 'secondary'}>
              {item.discord_id || 'Not linked'}
            </Text>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                label={item.discord_id ? 'Edit' : 'Set'}
                onClick={() => {
                  setEditingDiscordUser(item);
                  setDiscordIdInput(item.discord_id || '');
                }}
              />
            )}
          </HStack>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Joined',
      width: proportional(1),
      renderCell: (item) => (
        <Text size="sm" color="secondary">
          {item.created_at ? item.created_at.split('T')[0] : '—'}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(180),
      renderCell: (item) => (
        <HStack gap={2} vAlign="center">
          {item.id === currentUser?.id ? (
            <Button
              variant="secondary"
              size="sm"
              label="Change Password"
              onClick={() => {
                setShowPwModal(true);
                setPwError('');
                setPwSuccess('');
              }}
            />
          ) : isAdmin ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                label="Reset PW"
                onClick={() => handleResetPassword(item)}
              />
              <Button
                variant="ghost"
                size="sm"
                label="Delete"
                onClick={() => handleDeleteUser(item)}
              />
            </>
          ) : null}
        </HStack>
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader>
          <HStack gap={4} vAlign="center" justify="space-between" wrap="wrap">
            <VStack gap={1}>
              <Heading level={1}>Team Management</Heading>
              <Text color="secondary" size="sm">
                Manage team members, roles, permissions, and GitHub repository connections
              </Text>
            </VStack>

            <HStack gap={2}>
              <Button
                variant="secondary"
                label="Change Password"
                onClick={() => {
                  setShowPwModal(true);
                  setPwError('');
                  setPwSuccess('');
                }}
              />
              {isAdmin && (
                <Button
                  variant="primary"
                  label="+ Add Member"
                  onClick={() => {
                    setShowAddMember(true);
                    setAddUserError('');
                    setCreatedUserNotice(null);
                  }}
                />
              )}
            </HStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={6}>
            {/* Team Members Table */}
            <Card p={0} variant="subtle">
              <VStack gap={3} p={4}>
                <HStack gap={2} vAlign="center">
                  <Heading level={3} style={{ margin: 0 }}>Members</Heading>
                  <Badge variant="neutral">{users.length}</Badge>
                </HStack>
              </VStack>
              <Table
                data={users}
                columns={tableColumns}
                idKey="id"
                hasHover
              />
            </Card>

            {/* GitHub Repositories Section */}
            <Card p={5} variant="subtle">
              <VStack gap={4}>
                <VStack gap={1}>
                  <Heading level={3} style={{ margin: 0 }}>Connected Repositories</Heading>
                  <Text size="sm" color="secondary">
                    GitHub repositories integrated for automatic commit & PR linking
                  </Text>
                </VStack>

                {isAdmin && (
                  <HStack gap={3} vAlign="center">
                    <TextInput
                      label="Repository URL"
                      isLabelHidden
                      value={repoInput}
                      onChange={setRepoInput}
                      placeholder="e.g. https://github.com/lahacks/standup or owner/repo"
                    />
                    <Button
                      variant="primary"
                      label="Connect Repo"
                      onClick={handleAddRepo}
                      isLoading={repoLoading}
                    />
                  </HStack>
                )}

                <VStack gap={2}>
                  {repositories.length === 0 ? (
                    <Text size="sm" color="secondary">
                      No repositories connected yet.
                    </Text>
                  ) : (
                    repositories.map((repo) => (
                      <Card key={repo.id} p={3} variant="standard">
                        <HStack gap={3} vAlign="center" justify="space-between">
                          <VStack gap={0}>
                            <Text weight="semibold">{repo.owner}/{repo.name}</Text>
                            <Text size="xs" color="secondary">Default branch: {repo.default_branch || 'main'}</Text>
                          </VStack>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              label="Disconnect"
                              onClick={() => handleDeleteRepo(repo.id)}
                            />
                          )}
                        </HStack>
                      </Card>
                    ))
                  )}
                </VStack>
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      }
    >
      {/* Add Member Dialog */}
      {showAddMember && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setShowAddMember(false); }}
          width={480}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title="Add New Member"
                subtitle="Create a team member account"
                onOpenChange={() => setShowAddMember(false)}
              />
            }
            content={
              <LayoutContent>
                {createdUserNotice ? (
                  <VStack gap={4}>
                    <Text size="sm">
                      User <strong>@{createdUserNotice.username}</strong> created successfully!
                    </Text>
                    <Card p={3} variant="subtle">
                      <VStack gap={1}>
                        <Text size="xs" color="secondary">Temporary Password:</Text>
                        <Text weight="bold" style={{ fontFamily: 'monospace', fontSize: 16 }}>
                          {createdUserNotice.tempPassword}
                        </Text>
                      </VStack>
                    </Card>
                    <Text size="xs" color="secondary">
                      Share this temporary password with them. They will be prompted to set a new password on first login.
                    </Text>
                  </VStack>
                ) : (
                  <VStack gap={4}>
                    {addUserError && (
                      <Text color="error" size="sm">{addUserError}</Text>
                    )}
                    <TextInput
                      label="Username"
                      value={newUsername}
                      onChange={setNewUsername}
                      placeholder="e.g. alex"
                      isRequired
                    />
                  </VStack>
                )}
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  {createdUserNotice ? (
                    <Button label="Done" variant="primary" onClick={() => setShowAddMember(false)} />
                  ) : (
                    <>
                      <Button label="Cancel" variant="secondary" onClick={() => setShowAddMember(false)} />
                      <Button label="Create Account" variant="primary" onClick={handleAddUser} />
                    </>
                  )}
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Change Password Dialog */}
      {showPwModal && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setShowPwModal(false); }}
          width={440}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title="Change Password"
                subtitle="Update your Standup login credentials"
                onOpenChange={() => setShowPwModal(false)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  {pwError && <Text color="error" size="sm">{pwError}</Text>}
                  {pwSuccess && <Text color="success" size="sm">{pwSuccess}</Text>}
                  <TextInput
                    label="Current Password"
                    type="password"
                    value={currentPw}
                    onChange={setCurrentPw}
                    isRequired
                  />
                  <TextInput
                    label="New Password"
                    type="password"
                    value={newPw}
                    onChange={setNewPw}
                    placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                    isRequired
                  />
                  <TextInput
                    label="Confirm New Password"
                    type="password"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    isRequired
                  />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setShowPwModal(false)} />
                  <Button
                    label="Update Password"
                    variant="primary"
                    onClick={handleChangePassword}
                    isLoading={isPwLoading}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Reset Password Modal (Admin generated) */}
      {resetNotice && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setResetNotice(null); }}
          width={440}
          purpose="info"
        >
          <Layout
            header={
              <DialogHeader
                title="Password Reset"
                subtitle={`Temporary credentials for @${resetNotice.username}`}
                onOpenChange={() => setResetNotice(null)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <Text size="sm">
                    The temporary password for @{resetNotice.username} is:
                  </Text>
                  <Card p={3} variant="subtle">
                    <Text weight="bold" style={{ fontFamily: 'monospace', fontSize: 16 }}>
                      {resetNotice.tempPassword}
                    </Text>
                  </Card>
                  <Text size="xs" color="secondary">
                    Please securely share this with the user.
                  </Text>
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Done" variant="primary" onClick={() => setResetNotice(null)} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Discord ID Edit Dialog */}
      {editingDiscordUser && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setEditingDiscordUser(null); }}
          width={440}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title={`Set Discord ID for @${editingDiscordUser.username}`}
                subtitle="Enter numeric Discord user ID for notifications & mentions"
                onOpenChange={() => setEditingDiscordUser(null)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <TextInput
                    label="Discord User ID"
                    value={discordIdInput}
                    onChange={setDiscordIdInput}
                    placeholder="e.g. 204255221017214977"
                  />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setEditingDiscordUser(null)} />
                  <Button label="Save" variant="primary" onClick={handleSaveDiscord} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}
    </Layout>
  );
}
