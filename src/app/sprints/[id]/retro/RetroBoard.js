'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Avatar } from '@astryxdesign/core/Avatar';
import { TextArea } from '@astryxdesign/core/TextArea';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';

export default function RetroBoard({ sprintId, currentUser }) {
  const [notes, setNotes] = useState([]);
  const [sprint, setSprint] = useState(null);
  const [wentWellDraft, setWentWellDraft] = useState('');
  const [improveDraft, setImproveDraft] = useState('');
  const [isAddingWell, setIsAddingWell] = useState(false);
  const [isAddingImprove, setIsAddingImprove] = useState(false);

  async function fetchNotes() {
    try {
      const res = await apiFetch(`/api/sprints/${sprintId}/retro`);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to load retro notes:', err);
    }
  }

  async function fetchSprint() {
    try {
      const res = await apiFetch(`/api/sprints/${sprintId}`);
      const data = await res.json();
      if (data.sprint) setSprint(data.sprint);
    } catch {}
  }

  useEffect(() => {
    fetchNotes();
    fetchSprint();
  }, [sprintId]);

  async function handleAdd(category, content, clearFn, setBusy) {
    if (!content.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/sprints/${sprintId}/retro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, content: content.trim() }),
      });
      if (res.ok) {
        clearFn('');
        fetchNotes();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(noteId) {
    await apiFetch(`/api/sprints/${sprintId}/retro/${noteId}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  const wellNotes = notes.filter((n) => n.category === 'went_well');
  const improveNotes = notes.filter((n) => n.category === 'improve' || n.category === 'to_improve');

  return (
    <Layout
      header={
        <LayoutHeader>
          <HStack gap={4} vAlign="center" justify="space-between">
            <VStack gap={1}>
              <HStack gap={2} vAlign="center">
                <Link href="/sprints">
                  <Button variant="ghost" size="sm" label="← Sprints" />
                </Link>
                <Heading level={1}>
                  {sprint ? `${sprint.name} Retrospective` : 'Sprint Retrospective'}
                </Heading>
              </HStack>
              <Text color="secondary" size="sm">
                Reflect on what went well and identify areas for team improvement
              </Text>
            </VStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <HStack gap={6} align="start" wrap="wrap">
            {/* Column 1: What Went Well */}
            <Card p={5} variant="subtle" style={{ flex: 1, minWidth: 320 }}>
              <VStack gap={4}>
                <HStack gap={2} vAlign="center" justify="space-between">
                  <HStack gap={2} vAlign="center">
                    <StatusDot variant="success" />
                    <Heading level={3} style={{ margin: 0 }}>What Went Well</Heading>
                  </HStack>
                  <Badge variant="success">{wellNotes.length}</Badge>
                </HStack>

                {/* Add Form */}
                <VStack gap={2}>
                  <TextArea
                    label="What went well?"
                    isLabelHidden
                    value={wentWellDraft}
                    onChange={setWentWellDraft}
                    placeholder="Share a win, kudos, or positive highlight..."
                  />
                  <HStack justify="end">
                    <Button
                      variant="primary"
                      size="sm"
                      label="+ Add Note"
                      onClick={() => handleAdd('went_well', wentWellDraft, setWentWellDraft, setIsAddingWell)}
                      isLoading={isAddingWell}
                      isDisabled={!wentWellDraft.trim()}
                    />
                  </HStack>
                </VStack>

                {/* Notes List */}
                <VStack gap={3}>
                  {wellNotes.length === 0 ? (
                    <Text size="sm" color="secondary">
                      No positive notes yet. Add what worked well during this cycle!
                    </Text>
                  ) : (
                    wellNotes.map((note) => (
                      <Card key={note.id} p={3} variant="standard">
                        <VStack gap={2}>
                          <HStack gap={2} vAlign="center" justify="space-between">
                            <HStack gap={2} vAlign="center">
                              <Avatar name={note.author_username || 'User'} size="xsm" />
                              <Text size="xs" weight="semibold">@{note.author_username}</Text>
                              <Text size="xs" color="secondary">{timeAgo(note.created_at)}</Text>
                            </HStack>
                            {(currentUser?.role === 'admin' || currentUser?.id === note.author_id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                label="Delete"
                                onClick={() => handleDelete(note.id)}
                              />
                            )}
                          </HStack>
                          <Text size="sm">{note.content}</Text>
                        </VStack>
                      </Card>
                    ))
                  )}
                </VStack>
              </VStack>
            </Card>

            {/* Column 2: What Could Be Improved */}
            <Card p={5} variant="subtle" style={{ flex: 1, minWidth: 320 }}>
              <VStack gap={4}>
                <HStack gap={2} vAlign="center" justify="space-between">
                  <HStack gap={2} vAlign="center">
                    <StatusDot variant="warning" />
                    <Heading level={3} style={{ margin: 0 }}>What Could Be Improved</Heading>
                  </HStack>
                  <Badge variant="warning">{improveNotes.length}</Badge>
                </HStack>

                {/* Add Form */}
                <VStack gap={2}>
                  <TextArea
                    label="What could be improved?"
                    isLabelHidden
                    value={improveDraft}
                    onChange={setImproveDraft}
                    placeholder="Share a blocker, friction point, or process improvement..."
                  />
                  <HStack justify="end">
                    <Button
                      variant="primary"
                      size="sm"
                      label="+ Add Note"
                      onClick={() => handleAdd('improve', improveDraft, setImproveDraft, setIsAddingImprove)}
                      isLoading={isAddingImprove}
                      isDisabled={!improveDraft.trim()}
                    />
                  </HStack>
                </VStack>

                {/* Notes List */}
                <VStack gap={3}>
                  {improveNotes.length === 0 ? (
                    <Text size="sm" color="secondary">
                      No improvement notes yet. Add insights to improve the next sprint!
                    </Text>
                  ) : (
                    improveNotes.map((note) => (
                      <Card key={note.id} p={3} variant="standard">
                        <VStack gap={2}>
                          <HStack gap={2} vAlign="center" justify="space-between">
                            <HStack gap={2} vAlign="center">
                              <Avatar name={note.author_username || 'User'} size="xsm" />
                              <Text size="xs" weight="semibold">@{note.author_username}</Text>
                              <Text size="xs" color="secondary">{timeAgo(note.created_at)}</Text>
                            </HStack>
                            {(currentUser?.role === 'admin' || currentUser?.id === note.author_id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                label="Delete"
                                onClick={() => handleDelete(note.id)}
                              />
                            )}
                          </HStack>
                          <Text size="sm">{note.content}</Text>
                        </VStack>
                      </Card>
                    ))
                  )}
                </VStack>
              </VStack>
            </Card>
          </HStack>
        </LayoutContent>
      }
    />
  );
}
