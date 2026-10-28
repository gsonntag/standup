'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Divider } from '@astryxdesign/core/Divider';
import { apiFetch } from '@/lib/client-api';

function statusVariant(status) {
  switch (status) {
    case 'active': return 'accent';
    case 'completed': return 'success';
    case 'planning': return 'warning';
    default: return 'neutral';
  }
}

function formatDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return str;
  }
}

export default function SprintView({ currentUser }) {
  const [sprints, setSprints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [completingSprint, setCompletingSprint] = useState(null);
  const [rolloverTarget, setRolloverTarget] = useState('backlog');

  // Form states
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  async function fetchSprints() {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/sprints');
      const data = await res.json();
      setSprints(data.sprints || []);
    } catch (err) {
      console.error('Failed to load sprints:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSprints();
  }, []);

  function openCreate() {
    setFormName('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    setFormEndDate(twoWeeks.toISOString().split('T')[0]);
    setFormError('');
    setShowCreateDialog(true);
  }

  function openEdit(sprint) {
    setEditingSprint(sprint);
    setFormName(sprint.name || '');
    setFormStartDate(sprint.start_date ? sprint.start_date.split('T')[0] : '');
    setFormEndDate(sprint.end_date ? sprint.end_date.split('T')[0] : '');
    setFormError('');
  }

  async function handleCreateSprint() {
    if (!formName.trim()) {
      setFormError('Sprint name is required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      const res = await apiFetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          start_date: formStartDate || null,
          end_date: formEndDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create sprint.');
      } else {
        setShowCreateDialog(false);
        fetchSprints();
      }
    } catch {
      setFormError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSprint() {
    if (!formName.trim() || !editingSprint) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      const res = await apiFetch(`/api/sprints/${editingSprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          start_date: formStartDate || null,
          end_date: formEndDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update sprint.');
      } else {
        setEditingSprint(null);
        fetchSprints();
      }
    } catch {
      setFormError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStartSprint(sprintId) {
    const res = await apiFetch(`/api/sprints/${sprintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (res.ok) {
      fetchSprints();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to start sprint.');
    }
  }

  async function handleConfirmComplete() {
    if (!completingSprint) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/sprints/${completingSprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          rollover_to: rolloverTarget,
        }),
      });
      if (res.ok) {
        setCompletingSprint(null);
        fetchSprints();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to complete sprint.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSprint(sprintId) {
    if (!confirm('Are you sure you want to delete this sprint? Associated tickets will return to backlog.')) return;
    const res = await apiFetch(`/api/sprints/${sprintId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchSprints();
    }
  }

  const activeCount = sprints.filter((s) => s.status === 'active').length;
  const planningCount = sprints.filter((s) => s.status === 'planning').length;
  const completedCount = sprints.filter((s) => s.status === 'completed').length;

  const otherSprints = sprints.filter(
    (s) => completingSprint && s.id !== completingSprint.id && s.status !== 'completed'
  );

  const rolloverOptions = [
    { value: 'backlog', label: 'Move to Backlog' },
    ...otherSprints.map((s) => ({ value: String(s.id), label: `Move to ${s.name}` })),
  ];

  return (
    <Layout
      header={
        <LayoutHeader>
          <HStack gap={4} vAlign="center" justify="space-between" wrap="wrap">
            <VStack gap={1}>
              <Heading level={1}>Sprints</Heading>
              <Text color="secondary" size="sm">
                Organize work into engineering sprint cycles and retrospectives
              </Text>
            </VStack>

            {isAdmin && (
              <Button
                variant="primary"
                label="+ New Sprint"
                onClick={openCreate}
              />
            )}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={6}>
            {/* KPI Summary Cards */}
            <HStack gap={4} wrap="wrap">
              <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 160 }}>
                <VStack gap={1}>
                  <Text size="xs" weight="medium" color="secondary">ACTIVE SPRINTS</Text>
                  <Heading level={2} style={{ margin: 0 }}>{activeCount}</Heading>
                </VStack>
              </Card>

              <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 160 }}>
                <VStack gap={1}>
                  <Text size="xs" weight="medium" color="secondary">PLANNING</Text>
                  <Heading level={2} style={{ margin: 0 }}>{planningCount}</Heading>
                </VStack>
              </Card>

              <Card p={4} variant="subtle" style={{ flex: 1, minWidth: 160 }}>
                <VStack gap={1}>
                  <Text size="xs" weight="medium" color="secondary">COMPLETED</Text>
                  <Heading level={2} style={{ margin: 0 }}>{completedCount}</Heading>
                </VStack>
              </Card>
            </HStack>

            {/* Sprints List */}
            {isLoading ? (
              <VStack p={8} hAlign="center">
                <Text color="secondary">Loading sprints…</Text>
              </VStack>
            ) : sprints.length === 0 ? (
              <EmptyState
                title="No sprints found"
                description="Get started by creating your first sprint cycle."
                action={isAdmin ? <Button variant="primary" label="Create Sprint" onClick={openCreate} /> : null}
              />
            ) : (
              <VStack gap={4}>
                {sprints.map((sprint) => {
                  const totalTickets = sprint.ticket_count || 0;
                  const completedTickets = sprint.completed_ticket_count || 0;
                  const percent = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

                  return (
                    <Card key={sprint.id} p={5} variant="subtle">
                      <VStack gap={4}>
                        <HStack gap={3} vAlign="center" justify="space-between" wrap="wrap">
                          <HStack gap={3} vAlign="center">
                            <StatusDot variant={statusVariant(sprint.status)} />
                            <Heading level={3} style={{ margin: 0 }}>{sprint.name}</Heading>
                            <Badge variant={statusVariant(sprint.status)}>
                              {sprint.status.toUpperCase()}
                            </Badge>
                          </HStack>

                          <HStack gap={2} vAlign="center">
                            <Link href={`/sprints/${sprint.id}/retro`}>
                              <Button
                                variant="secondary"
                                size="sm"
                                label="Sprint Retro"
                              />
                            </Link>

                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  label="Edit"
                                  onClick={() => openEdit(sprint)}
                                />

                                {sprint.status === 'planning' && (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      label="Start Sprint"
                                      onClick={() => handleStartSprint(sprint.id)}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      label="Delete"
                                      onClick={() => handleDeleteSprint(sprint.id)}
                                    />
                                  </>
                                )}

                                {sprint.status === 'active' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    label="Complete Sprint"
                                    onClick={() => {
                                      setCompletingSprint(sprint);
                                      setRolloverTarget('backlog');
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </HStack>
                        </HStack>

                        <HStack gap={4} vAlign="center" color="secondary">
                          <Text size="sm">
                            {formatDate(sprint.start_date)} — {formatDate(sprint.end_date)}
                          </Text>
                          <Text size="sm">·</Text>
                          <Text size="sm">
                            {completedTickets} / {totalTickets} tickets done ({percent}%)
                          </Text>
                          {sprint.total_points != null && (
                            <>
                              <Text size="sm">·</Text>
                              <Text size="sm">{sprint.total_points} total story points</Text>
                            </>
                          )}
                        </HStack>

                        <ProgressBar
                          label={`Sprint progress for ${sprint.name}`}
                          isLabelHidden
                          value={percent}
                          max={100}
                          variant={statusVariant(sprint.status)}
                        />
                      </VStack>
                    </Card>
                  );
                })}
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
    >
      {/* Create Sprint Dialog */}
      {showCreateDialog && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}
          width={500}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title="Create New Sprint"
                subtitle="Define a date window and cycle name"
                onOpenChange={() => setShowCreateDialog(false)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  {formError && (
                    <Text color="error" size="sm">{formError}</Text>
                  )}
                  <TextInput
                    label="Sprint Name"
                    value={formName}
                    onChange={setFormName}
                    placeholder="e.g. Sprint 14 - API Hardening"
                    isRequired
                  />
                  <HStack gap={4}>
                    <TextInput
                      label="Start Date"
                      type="date"
                      value={formStartDate}
                      onChange={setFormStartDate}
                    />
                    <TextInput
                      label="End Date"
                      type="date"
                      value={formEndDate}
                      onChange={setFormEndDate}
                    />
                  </HStack>
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setShowCreateDialog(false)} />
                  <Button
                    label="Create Sprint"
                    variant="primary"
                    onClick={handleCreateSprint}
                    isLoading={isSubmitting}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Edit Sprint Dialog */}
      {editingSprint && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setEditingSprint(null); }}
          width={500}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title="Edit Sprint"
                subtitle={`Modify details for ${editingSprint.name}`}
                onOpenChange={() => setEditingSprint(null)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  {formError && (
                    <Text color="error" size="sm">{formError}</Text>
                  )}
                  <TextInput
                    label="Sprint Name"
                    value={formName}
                    onChange={setFormName}
                    isRequired
                  />
                  <HStack gap={4}>
                    <TextInput
                      label="Start Date"
                      type="date"
                      value={formStartDate}
                      onChange={setFormStartDate}
                    />
                    <TextInput
                      label="End Date"
                      type="date"
                      value={formEndDate}
                      onChange={setFormEndDate}
                    />
                  </HStack>
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setEditingSprint(null)} />
                  <Button
                    label="Save Changes"
                    variant="primary"
                    onClick={handleUpdateSprint}
                    isLoading={isSubmitting}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Complete Sprint Rollover Dialog */}
      {completingSprint && (
        <Dialog
          isOpen={true}
          onOpenChange={(open) => { if (!open) setCompletingSprint(null); }}
          width={480}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title={`Complete ${completingSprint.name}`}
                subtitle="Choose where uncompleted tickets should move"
                onOpenChange={() => setCompletingSprint(null)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <Text size="sm">
                    Incomplete tickets can either be moved to the backlog or rolled over into another sprint.
                  </Text>
                  <Selector
                    label="Rollover destination"
                    value={rolloverTarget}
                    onChange={setRolloverTarget}
                    options={rolloverOptions}
                  />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setCompletingSprint(null)} />
                  <Button
                    label="Complete Sprint"
                    variant="primary"
                    onClick={handleConfirmComplete}
                    isLoading={isSubmitting}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}
    </Layout>
  );
}
