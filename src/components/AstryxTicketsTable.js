'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useResizable, ResizeHandle } from '@astryxdesign/core/Resizable';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  LayoutPanel,
  HStack,
  VStack,
  StackItem,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Popover } from '@astryxdesign/core/Popover';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Center } from '@astryxdesign/core/Center';
import { Icon } from '@astryxdesign/core/Icon';
import { Divider } from '@astryxdesign/core/Divider';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Card } from '@astryxdesign/core/Card';
import {
  Table,
  useTableColumnResize,
  useTableGroupedRows,
  useTableStickyColumns,
  proportional,
  pixel,
} from '@astryxdesign/core/Table';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ArrowRightIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ChartBarIcon } from '@heroicons/react/24/solid';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  GitBranch as GitBranchIcon,
  Tag as PhosphorTagIcon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import { Markdown } from '@astryxdesign/core/Markdown';
import MarkdownRichEditor from './MarkdownRichEditor';
import TicketPullRequestsSection from './TicketPullRequestsSection';
import CreateTicketForm from './CreateTicketForm';

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function statusVariant(status) {
  switch (status) {
    case 'done': return 'success';
    case 'in_progress': return 'accent';
    case 'in_review': return 'neutral';
    case 'todo': return 'warning';
    default: return 'neutral';
  }
}

function priorityVariant(p) {
  switch (p) {
    case 'urgent': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'accent';
    default: return 'neutral';
  }
}

function priorityColor(p) {
  switch (p) {
    case 'urgent': return 'var(--color-status-error, #ef4444)';
    case 'high': return 'var(--color-status-warning, #f59e0b)';
    case 'medium': return 'var(--color-status-accent, #3b82f6)';
    default: return 'var(--color-text-secondary, #6b7280)';
  }
}

// Full-featured Editable Detail Panel docked on the right
function EditableTicketPanel({
  ticketId,
  onClose,
  onTicketUpdated,
  resizable,
  users,
  sprints,
  allTickets,
  allRepositories,
  allLabels,
}) {
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Pickers
  const [showBlockerPicker, setShowBlockerPicker] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState('');
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ticket) {
          setTicket(data.ticket);
          setTitleDraft(data.ticket.title || '');
          setDescDraft(data.ticket.description || '');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const fetchComments = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {}
  }, [ticketId]);

  useEffect(() => {
    setIsLoading(true);
    fetchDetail();
    fetchComments();
  }, [ticketId, fetchDetail, fetchComments]);

  // Update field on the ticket and sync back to parent
  async function updateField(field, value) {
    if (!ticket) return;
    const previous = ticket[field];
    setTicket((prev) => ({ ...prev, [field]: value }));

    try {
      const res = await apiFetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        setTicket((prev) => ({ ...prev, [field]: previous }));
      } else {
        const data = await res.json();
        if (data.ticket) {
          setTicket(data.ticket);
          onTicketUpdated?.();
        }
      }
    } catch {
      setTicket((prev) => ({ ...prev, [field]: previous }));
    }
  }

  async function saveTitle() {
    if (!titleDraft.trim()) return;
    await updateField('title', titleDraft.trim());
    setIsEditingTitle(false);
  }

  async function saveDescription() {
    await updateField('description', descDraft);
    setIsEditingDesc(false);
  }

  // Blocker actions
  async function handleAddBlocker(blockerTicketId) {
    try {
      const res = await apiFetch(`/api/tickets/${ticket.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depends_on_id: blockerTicketId }),
      });
      if (res.ok) {
        setShowBlockerPicker(false);
        setBlockerSearch('');
        fetchDetail();
        onTicketUpdated?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add blocker');
      }
    } catch {
      alert('Error adding dependency');
    }
  }

  async function handleRemoveBlocker(blockerTicketId) {
    try {
      const res = await apiFetch(`/api/tickets/${ticket.id}/dependencies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depends_on_id: blockerTicketId }),
      });
      if (res.ok) {
        fetchDetail();
        onTicketUpdated?.();
      }
    } catch {}
  }

  // Repository linking
  async function handleLinkRepo(repoId) {
    const current = ticket?.github_repositories || [];
    const existingIds = current.map((r) => r.id);
    if (existingIds.includes(repoId)) return;
    const nextIds = [...existingIds, repoId];

    const res = await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_repo_ids: nextIds }),
    });
    if (res.ok) {
      setShowRepoPicker(false);
      fetchDetail();
      onTicketUpdated?.();
    }
  }

  async function handleUnlinkRepo(repoId) {
    const current = ticket?.github_repositories || [];
    const nextIds = current.filter((r) => r.id !== repoId).map((r) => r.id);

    const res = await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_repo_ids: nextIds }),
    });
    if (res.ok) {
      fetchDetail();
      onTicketUpdated?.();
    }
  }

  // Labels
  async function handleAddLabel(labelId) {
    const res = await apiFetch(`/api/tickets/${ticket.id}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    if (res.ok) {
      setShowLabelPicker(false);
      fetchDetail();
      onTicketUpdated?.();
    }
  }

  async function handleRemoveLabel(labelId) {
    const res = await apiFetch(`/api/tickets/${ticket.id}/labels`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    if (res.ok) {
      fetchDetail();
      onTicketUpdated?.();
    }
  }

  // Comments
  async function handleAddComment() {
    if (!newComment.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
      }
    } finally {
      setIsPostingComment(false);
    }
  }

  async function handleDeleteTicket() {
    if (!confirm(`Are you sure you want to delete ticket #${ticket.number}?`)) return;
    const res = await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onClose();
      onTicketUpdated?.();
    }
  }

  function handleCopyMarkdown() {
    if (!ticket) return;
    const md = `# Ticket #${ticket.number}: ${ticket.title}\nStatus: ${ticket.status}\nPriority: ${ticket.priority}\n\n${ticket.description || ''}`;
    navigator.clipboard.writeText(md).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }

  // Candidate options
  const currentBlockerIds = useMemo(() => new Set((ticket?.blockers || []).map((b) => b.id)), [ticket]);
  const candidateBlockers = useMemo(() => {
    const q = blockerSearch.toLowerCase().trim();
    return allTickets
      .filter((t) => t.id !== ticket?.id && !currentBlockerIds.has(t.id))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || String(t.number).includes(q))
      .slice(0, 5);
  }, [allTickets, ticket, currentBlockerIds, blockerSearch]);

  const currentRepoIds = useMemo(() => new Set((ticket?.github_repositories || []).map((r) => r.id)), [ticket]);
  const candidateRepos = useMemo(() => {
    return allRepositories.filter((r) => !currentRepoIds.has(r.id));
  }, [allRepositories, currentRepoIds]);

  const currentLabelIds = useMemo(() => new Set((ticket?.labels || []).map((l) => l.id)), [ticket]);
  const candidateLabels = useMemo(() => {
    return allLabels.filter((l) => !currentLabelIds.has(l.id));
  }, [allLabels, currentLabelIds]);

  const assigneeOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    ...users.map((u) => ({ value: String(u.id), label: `@${u.username}` })),
  ];

  const sprintOptions = [
    { value: 'none', label: 'No Sprint (Backlog)' },
    ...sprints.map((s) => ({ value: String(s.id), label: `${s.name} (${s.status})` })),
  ];

  if (isLoading || !ticket) {
    return (
      <LayoutPanel
        hasDivider
        resizable={resizable}
        padding={4}
        role="complementary"
        label="Ticket details"
        style={{ minWidth: 320, overflowY: 'auto' }}
      >
        <VStack gap={4} p={4} hAlign="center">
          <Text size="sm" color="secondary">Loading ticket details…</Text>
        </VStack>
      </LayoutPanel>
    );
  }

  const blockers = ticket.blockers || [];
  const unblocks = ticket.unblocks || [];
  const linkedRepos = ticket.github_repositories || [];
  const labels = ticket.labels || [];

  return (
    <LayoutPanel
      hasDivider
      resizable={resizable}
      padding={4}
      role="complementary"
      label="Ticket details"
      style={{ minWidth: 320, overflowY: 'auto' }}
    >
      <VStack gap={4}>
        {/* Top Header Actions Bar */}
        <HStack gap={2} vAlign="center" justify="space-between">
          <HStack gap={2} vAlign="center">
            <Badge variant="neutral" style={{ fontFamily: 'monospace' }}>
              #{ticket.number}
            </Badge>
            <Badge variant={statusVariant(ticket.status)}>
              {ticket.status?.replaceAll('_', ' ').toUpperCase()}
            </Badge>
            <Badge variant={priorityVariant(ticket.priority)}>
              {ticket.priority?.toUpperCase()}
            </Badge>
          </HStack>

          <HStack gap={1} vAlign="center">
            <Link href={`/ticket/${ticket.number}`}>
              <Button variant="ghost" size="sm" label="Open ↗" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              label={copyFeedback ? 'Copied!' : 'Copy'}
              onClick={handleCopyMarkdown}
            />
            <Button
              label="Close"
              variant="ghost"
              size="sm"
              icon={<Icon icon={XMarkIcon} size="sm" />}
              isIconOnly
              onClick={onClose}
            />
          </HStack>
        </HStack>

        {/* Title Editing */}
        {isEditingTitle ? (
          <VStack gap={2}>
            <TextInput
              label="Title"
              isLabelHidden
              value={titleDraft}
              onChange={setTitleDraft}
              placeholder="Ticket title"
              size="sm"
            />
            <HStack gap={2}>
              <Button variant="primary" size="sm" label="Save" onClick={saveTitle} />
              <Button
                variant="secondary"
                size="sm"
                label="Cancel"
                onClick={() => {
                  setTitleDraft(ticket.title);
                  setIsEditingTitle(false);
                }}
              />
            </HStack>
          </VStack>
        ) : (
          <HStack gap={2} vAlign="start" justify="space-between">
            <Heading level={2} style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1.3 }}>
              {ticket.title}
            </Heading>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon={PencilIcon} size="sm" />}
              isIconOnly
              label="Edit title"
              onClick={() => setIsEditingTitle(true)}
            />
          </HStack>
        )}

        {/* Tab switcher: Details vs Comments */}
        <TabList value={activeTab} onChange={setActiveTab} size="sm">
          <Tab value="details" label="Details & Fields" />
          <Tab value="comments" label={`Comments (${comments.length})`} />
        </TabList>

        {activeTab === 'details' ? (
          <VStack gap={4}>
            {/* Core Attributes Metadata List */}
            <Card p={3} variant="subtle">
              <MetadataList label={{ position: 'start', width: 90 }}>
                {/* Status */}
                <MetadataListItem label="Status">
                  <HStack gap={2} vAlign="center">
                    <StatusDot variant={statusVariant(ticket.status)} />
                    <Selector
                      label="Status"
                      isLabelHidden
                      value={ticket.status || 'todo'}
                      onChange={(val) => updateField('status', val)}
                      options={STATUS_OPTIONS}
                      size="sm"
                    />
                  </HStack>
                </MetadataListItem>

                {/* Priority */}
                <MetadataListItem label="Priority">
                  <HStack gap={2} vAlign="center">
                    <Icon
                      icon={ChartBarIcon}
                      size="sm"
                      style={{ color: priorityColor(ticket.priority) }}
                    />
                    <Selector
                      label="Priority"
                      isLabelHidden
                      value={ticket.priority || 'medium'}
                      onChange={(val) => updateField('priority', val)}
                      options={PRIORITY_OPTIONS}
                      size="sm"
                    />
                  </HStack>
                </MetadataListItem>

                {/* Assignee */}
                <MetadataListItem label="Assignee">
                  <HStack gap={2} vAlign="center">
                    <Avatar name={ticket.assignee_username || 'Unassigned'} size="xsm" />
                    <Selector
                      label="Assignee"
                      isLabelHidden
                      value={ticket.assignee_id ? String(ticket.assignee_id) : 'unassigned'}
                      onChange={(val) => {
                        const uid = val === 'unassigned' ? null : val;
                        updateField('assignee_id', uid);
                      }}
                      options={assigneeOptions}
                      size="sm"
                    />
                  </HStack>
                </MetadataListItem>

                {/* Sprint */}
                <MetadataListItem label="Sprint">
                  <Selector
                    label="Sprint"
                    isLabelHidden
                    value={ticket.sprint_id ? String(ticket.sprint_id) : 'none'}
                    onChange={(val) => {
                      const sid = val === 'none' ? null : val;
                      updateField('sprint_id', sid);
                    }}
                    options={sprintOptions}
                    size="sm"
                  />
                </MetadataListItem>

                {/* Story Points */}
                <MetadataListItem label="Points">
                  <TextInput
                    label="Story Points"
                    isLabelHidden
                    type="number"
                    value={ticket.total_points != null ? String(ticket.total_points) : ''}
                    onChange={(val) => updateField('total_points', val ? parseInt(val, 10) : null)}
                    placeholder="0"
                    size="sm"
                  />
                </MetadataListItem>

                {/* Due Date */}
                <MetadataListItem label="Due Date">
                  <TextInput
                    label="Due Date"
                    isLabelHidden
                    type="date"
                    value={ticket.due_date ? ticket.due_date.split('T')[0] : ''}
                    onChange={(val) => updateField('due_date', val || null)}
                    size="sm"
                  />
                </MetadataListItem>
              </MetadataList>
            </Card>

            {/* Description Card with Markdown & Image support */}
            <Card p={3} variant="subtle">
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" justify="space-between">
                  <Text size="xs" weight="bold" color="secondary">
                    DESCRIPTION
                  </Text>
                  {!isEditingDesc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      label="Edit"
                      onClick={() => setIsEditingDesc(true)}
                    />
                  )}
                </HStack>
                {isEditingDesc ? (
                  <VStack gap={2}>
                    <MarkdownRichEditor
                      value={descDraft}
                      onChange={setDescDraft}
                      ticketId={ticket.id}
                      placeholder="Write description with markdown and images…"
                      minRows={5}
                    />
                    <HStack gap={2} justify="end">
                      <Button variant="primary" size="sm" label="Save Description" onClick={saveDescription} />
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Cancel"
                        onClick={() => {
                          setDescDraft(ticket.description || '');
                          setIsEditingDesc(false);
                        }}
                      />
                    </HStack>
                  </VStack>
                ) : (
                  <div style={{ lineHeight: 1.6, overflowX: 'auto' }}>
                    {ticket.description?.trim() ? (
                      <Markdown>{ticket.description}</Markdown>
                    ) : (
                      <Text size="sm" color="secondary" style={{ fontStyle: 'italic' }}>
                        No description provided. Click Edit to add markdown content and images.
                      </Text>
                    )}
                  </div>
                )}
              </VStack>
            </Card>

            {/* Pull Requests Section: Link specific PRs & Auto-detect Recent PRs */}
            <TicketPullRequestsSection
              ticketId={ticket.id}
              ticketNumber={ticket.number}
              ticketRepositories={linkedRepos}
              allRepositories={allRepositories}
              onChanged={() => {
                fetchDetail();
                onTicketUpdated?.();
              }}
            />

            {/* Labels Section */}
            <Card p={3} variant="subtle">
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" justify="space-between">
                  <HStack gap={1} vAlign="center">
                    <PhosphorTagIcon size={14} weight="bold" />
                    <Text size="xs" weight="bold" color="secondary">
                      LABELS ({labels.length})
                    </Text>
                  </HStack>
                  <Button
                    variant="ghost"
                    size="sm"
                    label={showLabelPicker ? 'Cancel' : '+ Add'}
                    onClick={() => setShowLabelPicker((v) => !v)}
                  />
                </HStack>

                {showLabelPicker && (
                  <Card p={2} variant="standard">
                    <HStack gap={1} wrap="wrap">
                      {candidateLabels.map((l) => (
                        <Badge
                          key={l.id}
                          variant="neutral"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleAddLabel(l.id)}
                        >
                          + {l.name}
                        </Badge>
                      ))}
                      {candidateLabels.length === 0 && (
                        <Text size="xs" color="secondary">All labels added.</Text>
                      )}
                    </HStack>
                  </Card>
                )}

                <HStack gap={1} wrap="wrap">
                  {labels.map((l) => (
                    <Badge key={l.id} variant="accent">
                      <HStack gap={1} vAlign="center">
                        <span>{l.name}</span>
                        <span
                          style={{ cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => handleRemoveLabel(l.id)}
                        >
                          ✕
                        </span>
                      </HStack>
                    </Badge>
                  ))}
                  {labels.length === 0 && (
                    <Text size="xs" color="secondary">No labels applied.</Text>
                  )}
                </HStack>
              </VStack>
            </Card>

            {/* Blockers & Dependencies */}
            <Card p={3} variant="subtle">
              <VStack gap={3}>
                <VStack gap={2}>
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <HStack gap={1} vAlign="center">
                      <WarningIcon size={16} weight="bold" style={{ color: 'var(--color-status-warning)' }} />
                      <Text size="xs" weight="bold" color="secondary">
                        BLOCKED BY ({blockers.length})
                      </Text>
                    </HStack>
                    <Button
                      variant="ghost"
                      size="sm"
                      label={showBlockerPicker ? 'Cancel' : '+ Add'}
                      onClick={() => setShowBlockerPicker((v) => !v)}
                    />
                  </HStack>

                  {showBlockerPicker && (
                    <Card p={2} variant="standard">
                      <VStack gap={2}>
                        <TextInput
                          label="Search blocker"
                          isLabelHidden
                          placeholder="Search ticket title or #…"
                          value={blockerSearch}
                          onChange={setBlockerSearch}
                          size="sm"
                        />
                        <VStack gap={1}>
                          {candidateBlockers.map((cand) => (
                            <Card
                              key={cand.id}
                              p={2}
                              variant="subtle"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleAddBlocker(cand.id)}
                            >
                              <HStack gap={2} vAlign="center" justify="space-between">
                                <HStack gap={1} vAlign="center">
                                  <Badge variant="neutral">#{cand.number}</Badge>
                                  <Text size="xs">{cand.title}</Text>
                                </HStack>
                                <Badge variant={statusVariant(cand.status)}>{cand.status}</Badge>
                              </HStack>
                            </Card>
                          ))}
                          {candidateBlockers.length === 0 && (
                            <Text size="xs" color="secondary">No matching tickets.</Text>
                          )}
                        </VStack>
                      </VStack>
                    </Card>
                  )}

                  <VStack gap={1}>
                    {blockers.map((b) => (
                      <Card key={b.id} p={2} variant="standard">
                        <HStack gap={2} vAlign="center" justify="space-between">
                          <HStack gap={1} vAlign="center">
                            <StatusDot variant={statusVariant(b.status)} />
                            <Link href={`/ticket/${b.number}`}>
                              <Text size="xs" weight="semibold">
                                #{b.number} {b.title}
                              </Text>
                            </Link>
                          </HStack>
                          <Button
                            variant="ghost"
                            size="sm"
                            label="✕"
                            onClick={() => handleRemoveBlocker(b.id)}
                          />
                        </HStack>
                      </Card>
                    ))}
                    {blockers.length === 0 && (
                      <Text size="xs" color="secondary">No blockers. Ticket is unblocked.</Text>
                    )}
                  </VStack>
                </VStack>

                {unblocks.length > 0 && (
                  <>
                    <Divider />
                    <VStack gap={2}>
                      <HStack gap={1} vAlign="center">
                        <CheckCircleIcon size={16} weight="bold" style={{ color: 'var(--color-status-success)' }} />
                        <Text size="xs" weight="bold" color="secondary">
                          BLOCKS ({unblocks.length})
                        </Text>
                      </HStack>
                      <VStack gap={1}>
                        {unblocks.map((u) => (
                          <Card key={u.id} p={2} variant="standard">
                            <HStack gap={1} vAlign="center">
                              <StatusDot variant={statusVariant(u.status)} />
                              <Link href={`/ticket/${u.number}`}>
                                <Text size="xs" weight="semibold">
                                  #{u.number} {u.title}
                                </Text>
                              </Link>
                            </HStack>
                          </Card>
                        ))}
                      </VStack>
                    </VStack>
                  </>
                )}
              </VStack>
            </Card>

            {/* Repositories */}
            <Card p={3} variant="subtle">
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" justify="space-between">
                  <HStack gap={1} vAlign="center">
                    <GitBranchIcon size={16} weight="bold" />
                    <Text size="xs" weight="bold" color="secondary">
                      GITHUB REPOSITORIES
                    </Text>
                  </HStack>
                  <Button
                    variant="ghost"
                    size="sm"
                    label={showRepoPicker ? 'Cancel' : '+ Link'}
                    onClick={() => setShowRepoPicker((v) => !v)}
                  />
                </HStack>

                {showRepoPicker && (
                  <Card p={2} variant="standard">
                    <VStack gap={1}>
                      {candidateRepos.map((r) => (
                        <Button
                          key={r.id}
                          variant="secondary"
                          size="sm"
                          label={`${r.owner}/${r.name}`}
                          onClick={() => handleLinkRepo(r.id)}
                        />
                      ))}
                      {candidateRepos.length === 0 && (
                        <Text size="xs" color="secondary">All connected repositories linked.</Text>
                      )}
                    </VStack>
                  </Card>
                )}

                <VStack gap={1}>
                  {linkedRepos.map((repo) => (
                    <Card key={repo.id} p={2} variant="standard">
                      <HStack gap={2} vAlign="center" justify="space-between">
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <Text size="xs" weight="semibold">
                            {repo.owner}/{repo.name} ↗
                          </Text>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          label="✕"
                          onClick={() => handleUnlinkRepo(repo.id)}
                        />
                      </HStack>
                    </Card>
                  ))}
                  {linkedRepos.length === 0 && (
                    <Text size="xs" color="secondary">No repository linked.</Text>
                  )}
                </VStack>
              </VStack>
            </Card>

            {/* Danger Zone: Delete Ticket */}
            <HStack justify="end">
              <Button
                variant="ghost"
                size="sm"
                label="Delete Ticket"
                icon={<Icon icon={TrashIcon} size="sm" />}
                onClick={handleDeleteTicket}
              />
            </HStack>
          </VStack>
        ) : (
          /* Comments Tab */
          <VStack gap={3}>
            {comments.map((c) => (
              <Card key={c.id} p={3} variant="subtle">
                <VStack gap={1}>
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <HStack gap={2} vAlign="center">
                      <Avatar name={c.author_username || 'User'} size="xsm" />
                      <Text size="xs" weight="semibold">@{c.author_username}</Text>
                      <Text size="xs" color="secondary">{timeAgo(c.created_at)}</Text>
                    </HStack>
                  </HStack>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Text>
                </VStack>
              </Card>
            ))}
            {comments.length === 0 && (
              <Text size="xs" color="secondary">No comments yet. Start discussion below.</Text>
            )}

            <VStack gap={2} mt={2}>
              <TextArea
                label="Comment"
                isLabelHidden
                placeholder="Write a comment…"
                value={newComment}
                onChange={setNewComment}
                rows={3}
              />
              <HStack justify="end">
                <Button
                  variant="primary"
                  size="sm"
                  label="Post Comment"
                  onClick={handleAddComment}
                  isLoading={isPostingComment}
                  isDisabled={!newComment.trim()}
                />
              </HStack>
            </VStack>
          </VStack>
        )}
      </VStack>
    </LayoutPanel>
  );
}

export default function AstryxTicketsTable({ currentUser = null, initialTicketId = null } = {}) {
  const [tickets, setTickets] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [labels, setLabels] = useState([]);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('status');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState(initialTicketId || null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [columnWidths, setColumnWidths] = useState({});

  // Resizable panel setup matching table-grouped template
  const detailPanel = useResizable({
    defaultSize: 420,
    minSize: 320,
    maxSize: 720,
  });

  const fetchTickets = useCallback(() => {
    apiFetch('/api/tickets')
      .then((res) => res.json())
      .then((data) => setTickets(Array.isArray(data) ? data : data.tickets || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTickets();
    apiFetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(Array.isArray(data) ? data : data.sprints || []))
      .catch(() => {});
    apiFetch('/api/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
    apiFetch('/api/github/repositories')
      .then((res) => res.json())
      .then((data) => setRepositories(data.repositories || []))
      .catch(() => {});
    apiFetch('/api/labels')
      .then((res) => res.json())
      .then((data) => setLabels(data.labels || []))
      .catch(() => {});
  }, [fetchTickets]);

  const onToggleGroup = useCallback((groupKey) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  async function quickUpdateStatus(ticketId, newStatus) {
    await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTickets();
  }

  async function handleDeleteTicket(ticketId, ticketNumber) {
    if (!confirm(`Are you sure you want to delete ticket #${ticketNumber}?`)) return;
    await apiFetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
    if (selectedTicketId === ticketId) setSelectedTicketId(null);
    fetchTickets();
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesNum = String(t.number).includes(q);
        if (!matchesTitle && !matchesNum) return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' && t.assignee_id) return false;
        if (assigneeFilter !== 'unassigned' && String(t.assignee_id) !== String(assigneeFilter)) return false;
      }
      if (sprintFilter !== 'all') {
        if (sprintFilter === 'backlog' && t.sprint_id) return false;
        if (sprintFilter !== 'backlog' && String(t.sprint_id) !== String(sprintFilter)) return false;
      }
      return true;
    });
  }, [tickets, search, priorityFilter, assigneeFilter, sprintFilter]);

  // Grouping function
  const groupKeyExtractor = useCallback((t) => {
    if (groupBy === 'status') {
      return t.status || 'todo';
    }
    if (groupBy === 'sprint') {
      return t.sprint_name || 'Backlog';
    }
    if (groupBy === 'priority') {
      return t.priority || 'medium';
    }
    return 'All';
  }, [groupBy]);

  const groupOrder = useMemo(() => {
    if (groupBy === 'status') {
      return ['in_progress', 'todo', 'in_review', 'done', 'backlog'];
    }
    if (groupBy === 'priority') {
      return ['urgent', 'high', 'medium', 'low'];
    }
    return undefined;
  }, [groupBy]);

  const grouped = useTableGroupedRows({
    data: filteredTickets,
    groupBy: groupKeyExtractor,
    collapsedGroups,
    onToggleGroup,
    getRowKey: (t) => t.id,
    groupOrder,
    renderGroupHeader: (groupKey, count, collapsed) => (
      <HStack gap={2} vAlign="center" p={2} style={{ userSelect: 'none' }}>
        <Icon
          icon={collapsed ? ChevronRightIcon : ChevronDownIcon}
          size="sm"
          color="secondary"
        />
        <StatusDot variant={statusVariant(groupKey)} />
        <Text size="sm" weight="bold">
          {groupKey.replaceAll('_', ' ').toUpperCase()}
        </Text>
        <Badge variant="neutral">{count}</Badge>
      </HStack>
    ),
  });

  // Columns definition: sticky right Actions column
  const columns = useMemo(() => [
    {
      key: 'status',
      header: '',
      width: pixel(44),
      resizable: false,
      renderCell: (t) => (
        <Center axis="horizontal">
          <StatusDot
            variant={statusVariant(t.status)}
            label={t.status ? t.status.replaceAll('_', ' ').toUpperCase() : 'TODO'}
          />
        </Center>
      ),
    },
    {
      key: 'title',
      header: 'Issue',
      width: proportional(2, { minWidth: 260 }),
      renderCell: (t) => (
        <HStack gap={2} vAlign="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
          <Icon
            icon={ChartBarIcon}
            size="sm"
            style={{ color: priorityColor(t.priority), flexShrink: 0 }}
          />
          <Badge
            variant="neutral"
            style={{ fontFamily: 'monospace', flexShrink: 0, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTicketId(t.id);
            }}
          >
            #{t.number}
          </Badge>
          <Text
            size="sm"
            weight="semibold"
            maxLines={1}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {t.title}
          </Text>
          {t.labels && t.labels.length > 0 && (
            <HStack gap={1} wrap="nowrap" style={{ flexShrink: 0 }}>
              {t.labels.slice(0, 2).map((l) => (
                <Badge key={l.id} variant="neutral" size="sm">
                  {l.name}
                </Badge>
              ))}
              {t.labels.length > 2 && (
                <Badge variant="neutral" size="sm">+{t.labels.length - 2}</Badge>
              )}
            </HStack>
          )}
        </HStack>
      ),
    },
    {
      key: 'sprint',
      header: 'Sprint',
      width: pixel(160),
      renderCell: (t) => (
        <Text size="xs" color="secondary" maxLines={1}>
          {t.sprint_name || 'Backlog'}
        </Text>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: pixel(110),
      renderCell: (t) => (
        <Text size="xs" color="secondary">
          {timeAgo(t.created_at)}
        </Text>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: pixel(110),
      renderCell: (t) => (
        <Text size="xs" color={t.due_date ? 'secondary' : 'disabled'}>
          {t.due_date ? t.due_date.split('T')[0] : '—'}
        </Text>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      width: pixel(160),
      renderCell: (t) => (
        <HStack gap={2} vAlign="center" wrap="nowrap">
          <Avatar name={t.assignee_username || 'Unassigned'} size="xsm" />
          <Text size="xs" maxLines={1}>
            {t.assignee_username ? `@${t.assignee_username}` : 'Unassigned'}
          </Text>
        </HStack>
      ),
    },
    {
      key: 'points',
      header: 'Points',
      width: pixel(85),
      renderCell: (t) => (
        <Text size="xs" weight="medium">
          {t.total_points != null ? `${t.total_points} pts` : '—'}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: pixel(88),
      resizable: false,
      renderCell: (t) => (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            width: '100%',
            backgroundColor: 'inherit',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu
            button={{
              label: 'Actions',
              variant: 'ghost',
              size: 'sm',
              icon: <Icon icon={EllipsisHorizontalIcon} size="sm" />,
              isIconOnly: true,
            }}
            hasChevron={false}
            items={[
              {
                label: 'Edit issue',
                icon: PencilIcon,
                onClick: () => setSelectedTicketId(t.id),
              },
              {
                label: 'Open as page ↗',
                icon: ArrowRightIcon,
                onClick: () => {
                  window.location.href = `/ticket/${t.number}`;
                },
              },
              {
                label: 'Copy markdown',
                icon: DocumentDuplicateIcon,
                onClick: () => {
                  navigator.clipboard.writeText(`# Ticket #${t.number}: ${t.title}`);
                },
              },
              { type: 'divider' },
              {
                label: t.status === 'done' ? 'Mark as In Progress' : 'Mark as Done',
                onClick: () => {
                  quickUpdateStatus(t.id, t.status === 'done' ? 'in_progress' : 'done');
                },
              },
              { type: 'divider' },
              {
                label: 'Delete issue',
                icon: TrashIcon,
                onClick: () => handleDeleteTicket(t.id, t.number),
              },
            ]}
          />
        </div>
      ),
    },
  ], [selectedTicketId]);

  // Column resize plugin
  const resizePlugin = useTableColumnResize({
    columnWidths,
    columns,
    onColumnResizeEnd: (updates) => {
      setColumnWidths((prev) => ({ ...prev, ...updates }));
    },
  });

  // Sticky columns plugin: pins the 'actions' column firmly to the right edge
  const stickyColumns = useTableStickyColumns({
    endKeys: ['actions'],
  });

  // Row click plugin: clicking anywhere on a row selects it and opens the side inspector panel
  const rowClickPlugin = useMemo(() => ({
    transformBodyRow(props, item) {
      if (!item || !item.id) return props;
      return {
        ...props,
        htmlProps: {
          ...props.htmlProps,
          style: {
            ...props.htmlProps?.style,
            cursor: 'pointer',
            backgroundColor:
              selectedTicketId === item.id
                ? 'var(--color-surface-hover, rgba(0,0,0,0.06))'
                : undefined,
          },
          onClick: (e) => {
            props.htmlProps?.onClick?.(e);
            setSelectedTicketId(item.id);
          },
        },
      };
    },
  }), [selectedTicketId]);

  // Combine plugins
  const plugins = useMemo(() => {
    const list = {
      columnResize: resizePlugin,
      stickyColumns,
      rowClick: rowClickPlugin,
    };
    if (groupBy !== 'none') {
      list.grouped = grouped.plugin;
    }
    return list;
  }, [resizePlugin, stickyColumns, rowClickPlugin, groupBy, grouped.plugin]);

  const assigneeOptions = [
    { value: 'all', label: 'All Assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...users.map((u) => ({ value: String(u.id), label: `@${u.username}` })),
  ];

  const sprintOptions = [
    { value: 'all', label: 'All Sprints' },
    { value: 'backlog', label: 'Backlog Only' },
    ...sprints.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider>
          <VStack gap={4}>
            {/* Header Title & CTA */}
            <HStack gap={4} vAlign="center" justify="space-between" wrap="wrap">
              <VStack gap={1}>
                <Heading level={1}>Tickets</Heading>
                <Text color="secondary" size="sm">
                  Grouped backlog and sprint issues with sticky actions and resizable editor
                </Text>
              </VStack>

              <Button
                variant="primary"
                label="+ Create issue"
                onClick={() => setIsCreateOpen(true)}
              />
            </HStack>

            {/* Filter Toolbar matching table-grouped */}
            <HStack gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill">
                <TextInput
                  label="Search"
                  isLabelHidden
                  placeholder="Filter issues by title or #number…"
                  value={search}
                  onChange={setSearch}
                  size="sm"
                />
              </StackItem>

              {/* View Options Popover with RadioList for Grouping */}
              <Popover
                placement="below"
                alignment="end"
                width={240}
                label="Grouping options"
                content={
                  <VStack gap={3} p={2}>
                    <Text size="xs" weight="bold" color="secondary">
                      GROUP BY
                    </Text>
                    <RadioList
                      label="Group by"
                      isLabelHidden
                      value={groupBy}
                      onChange={(v) => setGroupBy(v)}
                    >
                      <RadioListItem value="status" label="Status" />
                      <RadioListItem value="sprint" label="Sprint" />
                      <RadioListItem value="priority" label="Priority" />
                      <RadioListItem value="none" label="None (Flat)" />
                    </RadioList>
                  </VStack>
                }
              >
                <Button label="View Options" variant="secondary" size="sm" />
              </Popover>

              <Selector
                label="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  { value: 'all', label: 'All Priorities' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                size="sm"
              />

              <Selector
                label="Assignee"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={assigneeOptions}
                size="sm"
              />

              <Selector
                label="Sprint"
                value={sprintFilter}
                onChange={setSprintFilter}
                options={sprintOptions}
                size="sm"
              />
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={0} role="main">
          {filteredTickets.length === 0 ? (
            <VStack p={8} hAlign="center">
              <EmptyState
                title="No tickets match your filters"
                description="Try clearing your search query or reset the filter dropdowns."
                action={
                  <Button
                    variant="secondary"
                    label="Reset Filters"
                    onClick={() => {
                      setSearch('');
                      setPriorityFilter('all');
                      setAssigneeFilter('all');
                      setSprintFilter('all');
                    }}
                  />
                }
              />
            </VStack>
          ) : (
            <Card p={0} variant="subtle" style={{ borderRadius: 0, border: 'none', height: '100%' }}>
              <Table
                data={groupBy !== 'none' ? grouped.data : filteredTickets}
                columns={columns}
                idKey={groupBy !== 'none' ? grouped.idKey : 'id'}
                density="balanced"
                dividers="rows"
                textOverflow="truncate"
                hasHover
                plugins={plugins}
              />
            </Card>
          )}
        </LayoutContent>
      }
      end={
        selectedTicketId && (
          <>
            <ResizeHandle
              resizable={detailPanel.props}
              isReversed
              isAlwaysVisible={false}
            />
            <EditableTicketPanel
              ticketId={selectedTicketId}
              onClose={() => setSelectedTicketId(null)}
              onTicketUpdated={fetchTickets}
              resizable={detailPanel.props}
              users={users}
              sprints={sprints}
              allTickets={tickets}
              allRepositories={repositories}
              allLabels={labels}
            />
          </>
        )
      }
    >
      {/* Create Ticket Modal */}
      {isCreateOpen && (
        <CreateTicketForm
          users={users}
          onCreated={(newTicket) => {
            setIsCreateOpen(false);
            fetchTickets();
            if (newTicket?.id) setSelectedTicketId(newTicket.id);
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      )}
    </Layout>
  );
}
