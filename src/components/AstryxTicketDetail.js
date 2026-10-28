'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Drawer,
  DrawerHeader,
} from '@astryxdesign/core/Drawer';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Avatar } from '@astryxdesign/core/Avatar';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Card } from '@astryxdesign/core/Card';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Divider } from '@astryxdesign/core/Divider';
import { Markdown } from '@astryxdesign/core/Markdown';
import MarkdownRichEditor from '@/components/MarkdownRichEditor';
import TicketPullRequestsSection from '@/components/TicketPullRequestsSection';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  GitBranch as GitBranchIcon,
  Tag as TagIcon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';

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

export default function AstryxTicketDetail({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [commits, setCommits] = useState([]);
  const [prs, setPrs] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [allRepositories, setAllRepositories] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [allTickets, setAllTickets] = useState([]);

  const [activeTab, setActiveTab] = useState('comments');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Pickers
  const [showBlockerPicker, setShowBlockerPicker] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState('');
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const fetchTicket = useCallback(async () => {
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
    } catch (e) {
      console.error('Failed to refetch ticket:', e);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;

    fetchTicket();

    apiFetch(`/api/tickets/${ticketId}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => {});

    apiFetch(`/api/tickets/${ticketId}/commits`)
      .then((res) => res.json())
      .then((data) => setCommits(data.commits || []))
      .catch(() => {});

    apiFetch(`/api/tickets/${ticketId}/prs`)
      .then((res) => res.json())
      .then((data) => setPrs(data.prs || []))
      .catch(() => {});

    apiFetch('/api/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});

    apiFetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(data.sprints || []))
      .catch(() => {});

    apiFetch('/api/github/repositories')
      .then((res) => res.json())
      .then((data) => setAllRepositories(data.repositories || []))
      .catch(() => {});

    apiFetch('/api/labels')
      .then((res) => res.json())
      .then((data) => setAllLabels(data.labels || []))
      .catch(() => {});

    apiFetch('/api/tickets?limit=300')
      .then((res) => res.json())
      .then((data) => setAllTickets(data.tickets || []))
      .catch(() => {});

    apiFetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user || null))
      .catch(() => {});
  }, [ticketId, fetchTicket]);

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
        if (data.ticket) setTicket(data.ticket);
      }
    } catch {
      setTicket((prev) => ({ ...prev, [field]: previous }));
    }
  }

  async function saveTitle() {
    if (!titleDraft.trim()) return;
    setIsSaving(true);
    await updateField('title', titleDraft.trim());
    setIsSaving(false);
    setIsEditingTitle(false);
  }

  async function saveDescription() {
    setIsSaving(true);
    await updateField('description', descDraft);
    setIsSaving(false);
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
        fetchTicket();
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
        fetchTicket();
      }
    } catch {}
  }

  // Repository actions
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
      fetchTicket();
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
      fetchTicket();
    }
  }

  // Label actions
  async function handleAddLabel(labelId) {
    const res = await apiFetch(`/api/tickets/${ticket.id}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    if (res.ok) {
      setShowLabelPicker(false);
      fetchTicket();
    }
  }

  async function handleRemoveLabel(labelId) {
    const res = await apiFetch(`/api/tickets/${ticket.id}/labels`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    if (res.ok) {
      fetchTicket();
    }
  }

  // Comment actions
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

  async function handleDeleteComment(commentId) {
    await apiFetch(`/api/tickets/${ticket.id}/comments/${commentId}`, {
      method: 'DELETE',
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function handleDeleteTicket() {
    if (!confirm(`Are you sure you want to delete ticket #${ticket.number}?`)) return;
    const res = await apiFetch(`/api/tickets/${ticket.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onClose();
    }
  }

  function handleCopyMarkdown() {
    if (!ticket) return;
    const blockersText = (ticket.blockers || []).map((b) => `#${b.number} ${b.title}`).join(', ') || 'None';
    const reposText = (ticket.github_repositories || []).map((r) => `${r.owner}/${r.name}`).join(', ') || 'None';

    let md = `# Ticket #${ticket.number}: ${ticket.title}\n\n`;
    md += `- **Status**: ${ticket.status}\n`;
    md += `- **Priority**: ${ticket.priority}\n`;
    md += `- **Assignee**: ${ticket.assignee_username || 'Unassigned'}\n`;
    md += `- **Repositories**: ${reposText}\n`;
    md += `- **Blockers**: ${blockersText}\n\n`;
    md += `## Description\n${ticket.description || 'No description'}\n`;
    navigator.clipboard.writeText(md).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }

  // Candidates for pickers
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

  const blockers = ticket?.blockers || [];
  const unblocks = ticket?.unblocks || [];
  const linkedRepos = ticket?.github_repositories || [];
  const labels = ticket?.labels || [];

  return (
    <Drawer
      isOpen={true}
      onOpenChange={(open) => { if (!open) onClose(); }}
      label={ticket ? `Ticket #${ticket.number}` : 'Ticket'}
      width={680}
      purpose="form"
    >
      <Layout
        header={
          <DrawerHeader
            title={ticket ? `#${ticket.number} ${ticket.title}` : 'Ticket'}
            subtitle={
              ticket
                ? `Created by @${ticket.creator_username || 'unknown'} · ${timeAgo(ticket.created_at)}`
                : 'Loading...'
            }
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent>
            {!ticket ? (
              <VStack gap={4} p={4} hAlign="center">
                <Text color="secondary">Loading ticket details…</Text>
              </VStack>
            ) : (
              <VStack gap={5}>
                {/* Actions & Full Page Link */}
                <HStack gap={2} vAlign="center" justify="space-between" wrap="wrap">
                  <HStack gap={2} vAlign="center">
                    <Badge variant={statusVariant(ticket.status)}>
                      {ticket.status?.replaceAll('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant={priorityVariant(ticket.priority)}>
                      {ticket.priority?.toUpperCase()}
                    </Badge>
                  </HStack>

                  <HStack gap={2} vAlign="center">
                    <Link href={`/ticket/${ticket.number}`}>
                      <Button variant="ghost" size="sm" label="Open as page ↗" />
                    </Link>
                    <Button
                      label={copyFeedback ? 'Copied!' : 'Copy Info'}
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyMarkdown}
                    />
                  </HStack>
                </HStack>

                {/* Title */}
                {isEditingTitle ? (
                  <VStack gap={2}>
                    <TextInput
                      label="Ticket Title"
                      isLabelHidden
                      value={titleDraft}
                      onChange={setTitleDraft}
                      placeholder="Enter ticket title"
                    />
                    <HStack gap={2}>
                      <Button
                        label="Save"
                        variant="primary"
                        size="sm"
                        onClick={saveTitle}
                        isLoading={isSaving}
                      />
                      <Button
                        label="Cancel"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setTitleDraft(ticket.title);
                          setIsEditingTitle(false);
                        }}
                      />
                    </HStack>
                  </VStack>
                ) : (
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <Heading level={2} style={{ margin: 0, fontSize: '1.25rem' }}>
                      {ticket.title}
                    </Heading>
                    <Button
                      label="Edit"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTitle(true)}
                    />
                  </HStack>
                )}

                {/* Description */}
                <Card p={4} variant="subtle">
                  <VStack gap={3}>
                    <HStack gap={2} vAlign="center" justify="space-between">
                      <Text size="sm" weight="semibold" color="secondary">
                        Description
                      </Text>
                      {!isEditingDesc && (
                        <Button
                          label="Edit"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDescDraft(ticket.description || '');
                            setIsEditingDesc(true);
                          }}
                        />
                      )}
                    </HStack>
                    {isEditingDesc ? (
                      <VStack gap={2}>
                        <MarkdownRichEditor
                          value={descDraft}
                          onChange={setDescDraft}
                          ticketId={ticket.id}
                          placeholder="Write markdown description, paste or drop images..."
                          minRows={6}
                        />
                        <HStack gap={2}>
                          <Button
                            label="Save"
                            variant="primary"
                            size="sm"
                            onClick={saveDescription}
                            isLoading={isSaving}
                          />
                          <Button
                            label="Cancel"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setDescDraft(ticket.description || '');
                              setIsEditingDesc(false);
                            }}
                          />
                        </HStack>
                      </VStack>
                    ) : (
                      ticket.description ? (
                        <Markdown>{ticket.description}</Markdown>
                      ) : (
                        <Text size="sm" color="secondary" style={{ fontStyle: 'italic' }}>
                          No description provided. Click Edit to add markdown and screenshots.
                        </Text>
                      )
                    )}
                  </VStack>
                </Card>

                {/* Blockers & Dependencies Section */}
                <Card p={4} variant="subtle">
                  <VStack gap={3}>
                    {/* Blocked by */}
                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center" justify="space-between">
                        <HStack gap={2} vAlign="center">
                          <WarningIcon weight="bold" style={{ color: 'var(--color-status-warning)' }} />
                          <Text size="sm" weight="semibold">
                            Blocked By ({blockers.length})
                          </Text>
                        </HStack>
                        <Button
                          variant="secondary"
                          size="sm"
                          label={showBlockerPicker ? 'Cancel' : '+ Add Blocker'}
                          onClick={() => setShowBlockerPicker((v) => !v)}
                        />
                      </HStack>

                      {showBlockerPicker && (
                        <Card p={3} variant="standard">
                          <VStack gap={2}>
                            <TextInput
                              label="Search ticket"
                              isLabelHidden
                              placeholder="Type title or #number to search…"
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
                                    <HStack gap={2} vAlign="center">
                                      <Badge variant="neutral">#{cand.number}</Badge>
                                      <Text size="xs" weight="medium">{cand.title}</Text>
                                    </HStack>
                                    <Badge variant={statusVariant(cand.status)}>{cand.status}</Badge>
                                  </HStack>
                                </Card>
                              ))}
                              {candidateBlockers.length === 0 && (
                                <Text size="xs" color="secondary">No matching tickets found.</Text>
                              )}
                            </VStack>
                          </VStack>
                        </Card>
                      )}

                      {blockers.length === 0 ? (
                        <Text size="xs" color="secondary">No blockers. This ticket is unblocked.</Text>
                      ) : (
                        <VStack gap={2}>
                          {blockers.map((b) => (
                            <Card key={b.id} p={2} variant="standard">
                              <HStack gap={2} vAlign="center" justify="space-between">
                                <HStack gap={2} vAlign="center">
                                  <StatusDot variant={statusVariant(b.status)} />
                                  <Link href={`/ticket/${b.number}`}>
                                    <Text size="xs" weight="semibold">
                                      #{b.number} {b.title}
                                    </Text>
                                  </Link>
                                  <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
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
                        </VStack>
                      )}
                    </VStack>

                    {unblocks.length > 0 && (
                      <>
                        <Divider />
                        <VStack gap={2}>
                          <HStack gap={2} vAlign="center">
                            <CheckCircleIcon weight="bold" style={{ color: 'var(--color-status-success)' }} />
                            <Text size="sm" weight="semibold">
                              Blocks ({unblocks.length})
                            </Text>
                          </HStack>
                          <VStack gap={2}>
                            {unblocks.map((u) => (
                              <Card key={u.id} p={2} variant="standard">
                                <HStack gap={2} vAlign="center" justify="space-between">
                                  <HStack gap={2} vAlign="center">
                                    <StatusDot variant={statusVariant(u.status)} />
                                    <Link href={`/ticket/${u.number}`}>
                                      <Text size="xs" weight="semibold">
                                        #{u.number} {u.title}
                                      </Text>
                                    </Link>
                                    <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                                  </HStack>
                                </HStack>
                              </Card>
                            ))}
                          </VStack>
                        </VStack>
                      </>
                    )}
                  </VStack>
                </Card>

                {/* Repositories & Labels Card */}
                <Card p={4} variant="subtle">
                  <VStack gap={4}>
                    {/* Linked Repositories */}
                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center" justify="space-between">
                        <HStack gap={1} vAlign="center">
                          <GitBranchIcon weight="bold" />
                          <Text size="sm" weight="semibold">GitHub Repositories</Text>
                        </HStack>
                        <Button
                          variant="ghost"
                          size="sm"
                          label={showRepoPicker ? 'Cancel' : '+ Link'}
                          onClick={() => setShowRepoPicker((v) => !v)}
                        />
                      </HStack>

                      {showRepoPicker && (
                        <Card p={3} variant="standard">
                          <VStack gap={1}>
                            <Text size="xs" weight="bold">Select repository to link:</Text>
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

                      <VStack gap={2}>
                        {linkedRepos.map((repo) => (
                          <Card key={repo.id} p={2} variant="standard">
                            <HStack gap={2} vAlign="center" justify="space-between">
                              <HStack gap={1} vAlign="center">
                                <GitBranchIcon weight="bold" size={14} />
                                {repo.html_url ? (
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
                                ) : (
                                  <Text size="xs" weight="semibold">
                                    {repo.owner}/{repo.name}
                                  </Text>
                                )}
                              </HStack>
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

                    <Divider />

                    {/* Labels */}
                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center" justify="space-between">
                        <HStack gap={1} vAlign="center">
                          <TagIcon weight="bold" />
                          <Text size="sm" weight="semibold">Labels</Text>
                        </HStack>
                        <Button
                          variant="ghost"
                          size="sm"
                          label={showLabelPicker ? 'Cancel' : '+ Add'}
                          onClick={() => setShowLabelPicker((v) => !v)}
                        />
                      </HStack>

                      {showLabelPicker && (
                        <Card p={3} variant="standard">
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
                  </VStack>
                </Card>

                {/* Attributes in MetadataList */}
                <Card p={4} variant="subtle">
                  <MetadataList label={{ position: 'start', width: 110 }}>
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

                    <MetadataListItem label="Priority">
                      <Selector
                        label="Priority"
                        isLabelHidden
                        value={ticket.priority || 'medium'}
                        onChange={(val) => updateField('priority', val)}
                        options={PRIORITY_OPTIONS}
                        size="sm"
                      />
                    </MetadataListItem>

                    <MetadataListItem label="Assignee">
                      <HStack gap={2} vAlign="center">
                        <Avatar name={ticket.assignee_username || 'Unassigned'} size="xsm" />
                        <Selector
                          label="Assignee"
                          isLabelHidden
                          value={ticket.assignee_id ? String(ticket.assignee_id) : 'unassigned'}
                          onChange={(val) => {
                            const id = val === 'unassigned' ? null : val;
                            updateField('assignee_id', id);
                          }}
                          options={assigneeOptions}
                          size="sm"
                        />
                      </HStack>
                    </MetadataListItem>

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

                    <MetadataListItem label="Story Points">
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

                {/* Tabbed Activity / Comments / Commits / PRs */}
                <TabList value={activeTab} onChange={setActiveTab} size="sm">
                  <Tab
                    value="comments"
                    label={`Comments (${comments.length})`}
                  />
                  <Tab
                    value="activity"
                    label={`Activity (${ticket.events?.length || 0})`}
                  />
                  <Tab
                    value="git"
                    label={`GitHub (${prs.length + commits.length})`}
                  />
                </TabList>

                {/* Comments Panel */}
                {activeTab === 'comments' && (
                  <VStack gap={3}>
                    {comments.length === 0 ? (
                      <Text size="sm" color="secondary">
                        No comments yet. Start the conversation below.
                      </Text>
                    ) : (
                      comments.map((comment) => (
                        <Card key={comment.id} p={3} variant="subtle">
                          <VStack gap={2}>
                            <HStack gap={2} vAlign="center" justify="space-between">
                              <HStack gap={2} vAlign="center">
                                <Avatar
                                  name={comment.author_username || 'User'}
                                  size="sm"
                                />
                                <Text size="sm" weight="semibold">
                                  @{comment.author_username}
                                </Text>
                                <Text size="xs" color="secondary">
                                  {timeAgo(comment.created_at)}
                                </Text>
                              </HStack>
                              {(currentUser?.role === 'admin' ||
                                currentUser?.id === comment.author_id) && (
                                <Button
                                  label="Delete"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteComment(comment.id)}
                                />
                              )}
                            </HStack>
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                              {comment.content}
                            </Text>
                          </VStack>
                        </Card>
                      ))
                    )}

                    {/* Add Comment Input */}
                    <VStack gap={2} mt={2}>
                      <TextArea
                        label="Add a comment"
                        isLabelHidden
                        value={newComment}
                        onChange={setNewComment}
                        placeholder="Write a comment…"
                      />
                      <HStack gap={2} justify="end">
                        <Button
                          label="Post Comment"
                          variant="primary"
                          size="sm"
                          onClick={handleAddComment}
                          isLoading={isPostingComment}
                          isDisabled={!newComment.trim()}
                        />
                      </HStack>
                    </VStack>
                  </VStack>
                )}

                {/* Activity Stream */}
                {activeTab === 'activity' && (
                  <VStack gap={2}>
                    {(ticket.events || []).length === 0 ? (
                      <Text size="sm" color="secondary">No activity logged.</Text>
                    ) : (
                      ticket.events.map((evt, idx) => (
                        <HStack key={idx} gap={2} vAlign="center">
                          <StatusDot variant="neutral" />
                          <Text size="xs" color="secondary">
                            {evt.actor_username ? `@${evt.actor_username}` : 'System'}{' '}
                            {evt.action || 'updated ticket'} · {timeAgo(evt.created_at)}
                          </Text>
                        </HStack>
                      ))
                    )}
                  </VStack>
                )}

                {/* GitHub PRs and Commits */}
                {activeTab === 'git' && (
                  <VStack gap={4}>
                    <TicketPullRequestsSection
                      ticketId={ticket.id || ticket.number}
                      ticketNumber={ticket.number}
                      ticketRepositories={linkedRepos}
                      allRepositories={allRepositories}
                      onChanged={fetchTicket}
                    />

                    <Divider />

                    <VStack gap={2}>
                      <Heading level={4} size="sm">Commits</Heading>
                      {commits.length === 0 ? (
                        <Text size="xs" color="secondary">No linked commits.</Text>
                      ) : (
                        commits.map((c) => (
                          <HStack key={c.id} gap={2} vAlign="center" justify="space-between">
                            <HStack gap={2} vAlign="center">
                              <Badge variant="neutral">{c.short_sha || c.sha?.slice(0, 7)}</Badge>
                              <Text size="xs">{c.message?.split('\n')[0]}</Text>
                            </HStack>
                            <HStack gap={2} vAlign="center">
                              <Text size="xs" color="secondary">@{c.author_login || c.author_name}</Text>
                              {c.html_url && (
                                <a href={c.html_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" label="Commit ↗" />
                                </a>
                              )}
                            </HStack>
                          </HStack>
                        ))
                      )}
                    </VStack>
                  </VStack>
                )}
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} vAlign="center" justify="space-between">
              <Button
                label="Delete Ticket"
                variant="ghost"
                size="sm"
                onClick={handleDeleteTicket}
              />
              <Button label="Close" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}
