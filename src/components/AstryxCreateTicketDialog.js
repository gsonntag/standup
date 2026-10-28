'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { apiFetch } from '@/lib/client-api';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'backlog', label: 'Backlog' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function AstryxCreateTicketDialog({ users = [], onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [sprintId, setSprintId] = useState('none');
  const [totalPoints, setTotalPoints] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprints, setSprints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(data.sprints || []))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          sprint_id: sprintId === 'none' ? null : sprintId,
          assignee_id: assigneeId === 'unassigned' ? null : assigneeId,
          total_points: totalPoints ? parseInt(totalPoints, 10) : null,
          points_remaining: totalPoints ? parseInt(totalPoints, 10) : null,
          due_date: dueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create ticket');
      } else {
        onCreated?.(data.ticket);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const assigneeOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    ...users.map((u) => ({ value: String(u.id), label: `@${u.username}` })),
  ];

  const sprintOptions = [
    { value: 'none', label: 'None (Backlog)' },
    ...sprints.map((s) => ({ value: String(s.id), label: `${s.name} (${s.status})` })),
  ];

  return (
    <Dialog
      isOpen={true}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      width={600}
      purpose="form"
    >
      <Layout
        header={
          <DialogHeader
            title="Create New Ticket"
            subtitle="Add a task, feature, or bug to the backlog or active sprint"
            onOpenChange={() => onCancel()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {error && (
                <Text color="error" size="sm" weight="semibold">
                  {error}
                </Text>
              )}

              <TextInput
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Ticket summary or task description"
                isRequired
              />

              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="Provide detailed requirements, reproduction steps, or context"
              />

              <HStack gap={4}>
                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Status</Text>
                  <Selector
                    label="Status"
                    isLabelHidden
                    value={status}
                    onChange={setStatus}
                    options={STATUS_OPTIONS}
                  />
                </VStack>

                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Priority</Text>
                  <Selector
                    label="Priority"
                    isLabelHidden
                    value={priority}
                    onChange={setPriority}
                    options={PRIORITY_OPTIONS}
                  />
                </VStack>
              </HStack>

              <HStack gap={4}>
                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Assignee</Text>
                  <Selector
                    label="Assignee"
                    isLabelHidden
                    value={assigneeId}
                    onChange={setAssigneeId}
                    options={assigneeOptions}
                  />
                </VStack>

                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Sprint</Text>
                  <Selector
                    label="Sprint"
                    isLabelHidden
                    value={sprintId}
                    onChange={setSprintId}
                    options={sprintOptions}
                  />
                </VStack>
              </HStack>

              <HStack gap={4}>
                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Story Points</Text>
                  <TextInput
                    label="Story Points"
                    isLabelHidden
                    type="number"
                    value={totalPoints}
                    onChange={setTotalPoints}
                    placeholder="e.g. 3, 5, 8"
                  />
                </VStack>

                <VStack gap={1} style={{ flex: 1 }}>
                  <Text size="xs" weight="medium">Due Date</Text>
                  <TextInput
                    label="Due Date"
                    isLabelHidden
                    type="date"
                    value={dueDate}
                    onChange={setDueDate}
                  />
                </VStack>
              </HStack>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onCancel} />
              <Button
                label="Create Ticket"
                variant="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
