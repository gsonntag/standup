'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Divider } from '@astryxdesign/core/Divider';
import {
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  LinkIcon,
  TagIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import { Markdown } from '@astryxdesign/core/Markdown';
import MarkdownRichEditor from './MarkdownRichEditor';
import TicketPullRequestsSection from './TicketPullRequestsSection';

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

export default function AstryxTicketPage({ ticketId, initialTicket = null, currentUser }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [comments, setComments] = useState([]);
  const [commits, setCommits] = useState([]);
  const [prs, setPrs] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [allRepositories, setAllRepositories] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(!initialTicket);

  const [activeTab, setActiveTab] = useState('comments');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTicket?.title || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(initialTicket?.description || '');
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Blocker search picker
  const [showBlockerPicker, setShowBlockerPicker] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState('');

  // Repo search picker
  const [showRepoPicker, setShowRepoPicker] = useState(false);

  // Label search picker
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const fetchTicket = async () => {
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}`);
      const data = await res.json();
      if (data.ticket) {
        setTicket(data.ticket);
        setTitleDraft(data.ticket.title || '');
        setDescDraft(data.ticket.description || '');
      }
    } catch (err) {
      console.error('Failed to load ticket:', err);
    }
  };

  useEffect(() => {
    if (!ticketId) return;

    if (!ticket) setIsLoading(true);
    Promise.all([
      apiFetch(`/api/tickets/${ticketId}`).then((r) => r.json()),
      apiFetch(`/api/tickets/${ticketId}/comments`).then((r) => r.json()).catch(() => ({ comments: [] })),
      apiFetch(`/api/tickets/${ticketId}/commits`).then((r) => r.json()).catch(() => ({ commits: [] })),
      apiFetch(`/api/tickets/${ticketId}/prs`).then((r) => r.json()).catch(() => ({ prs: [] })),
      apiFetch('/api/users').then((r) => r.json()).catch(() => ({ users: [] })),
      apiFetch('/api/sprints').then((r) => r.json()).catch(() => ({ sprints: [] })),
      apiFetch('/api/github/repositories').then((r) => r.json()).catch(() => ({ repositories: [] })),
      apiFetch('/api/labels').then((r) => r.json()).catch(() => ({ labels: [] })),
      apiFetch('/api/tickets?limit=300').then((r) => r.json()).catch(() => ({ tickets: [] })),
    ])
      .then(([tData, cData, comData, prData, uData, sData, rData, lData, allTData]) => {
        if (tData.ticket) {
          setTicket(tData.ticket);
          setTitleDraft(tData.ticket.title || '');
          setDescDraft(tData.ticket.description || '');
        }
        setComments(cData.comments || []);
        setCommits(comData.commits || []);
        setPrs(prData.prs || []);
        setUsers(uData.users || []);
        setSprints(sData.sprints || []);
        setAllRepositories(rData.repositories || []);
        setAllLabels(lData.labels || []);
        setAllTickets(allTData.tickets || []);
      })
      .finally(() => setIsLoading(false));
  }, [ticketId]);

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
        fetchTicket();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add blocker');
      }
    } catch (e) {
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

  // Repository linking actions
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

  async function handleDeleteComment(commentId) {
    await apiFetch(`/api/tickets/${ticket.id}/comments/${commentId}`, { method: 'DELETE' });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function handleDeleteTicket() {
    if (!confirm(`Are you sure you want to delete ticket #${ticket.number}? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/tickets');
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

  // Blocker search candidate list
  const currentBlockerIds = new Set((ticket?.blockers || []).map((b) => b.id));
  const candidateBlockers = useMemo(() => {
    const q = blockerSearch.toLowerCase().trim();
    return allTickets
      .filter((t) => t.id !== ticket?.id && !currentBlockerIds.has(t.id))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || String(t.number).includes(q))
      .slice(0, 6);
  }, [allTickets, ticket, currentBlockerIds, blockerSearch]);

  // Unlinked repositories candidates
  const currentRepoIds = new Set((ticket?.github_repositories || []).map((r) => r.id));
  const candidateRepos = allRepositories.filter((r) => !currentRepoIds.has(r.id));

  // Unlinked labels candidates
  const currentLabelIds = new Set((ticket?.labels || []).map((l) => l.id));
  const candidateLabels = allLabels.filter((l) => !currentLabelIds.has(l.id));

  const assigneeOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    ...users.map((u) => ({ value: String(u.id), label: `@${u.username}` })),
  ];

  const sprintOptions = [
    { value: 'none', label: 'Backlog (No Sprint)' },
    ...sprints.map((s) => ({ value: String(s.id), label: `${s.name} (${s.status})` })),
  ];

  if (isLoading && !ticket) {
    return (
      <Layout
        header={
          <LayoutHeader>
            <HStack gap={2} vAlign="center">
              <Link href="/tickets">
                <Button variant="ghost" size="sm" label="← Tickets" />
              </Link>
              <Heading level={2}>Loading ticket details…</Heading>
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            <VStack p={8} hAlign="center">
              <Text color="secondary">Loading ticket data...</Text>
            </VStack>
          </LayoutContent>
        }
      />
    );
  }

  if (!ticket) {
    return (
      <Layout
        header={
          <LayoutHeader>
            <HStack gap={2} vAlign="center">
              <Link href="/tickets">
                <Button variant="ghost" size="sm" label="← Tickets" />
              </Link>
              <Heading level={2}>Ticket Not Found</Heading>
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            <VStack p={8} hAlign="center" gap={4}>
              <Text color="secondary">The requested ticket does not exist or was removed.</Text>
              <Link href="/tickets">
                <Button variant="primary" label="Return to Tickets" />
              </Link>
            </VStack>
          </LayoutContent>
        }
      />
    );
  }

  const blockers = ticket.blockers || [];
  const unblocks = ticket.unblocks || [];
  const linkedRepos = ticket.github_repositories || [];
  const labels = ticket.labels || [];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            {/* Breadcrumb & Navigation */}
            <HStack gap={3} vAlign="center" justify="space-between" wrap="wrap">
              <HStack gap={2} vAlign="center">
                <Link href="/tickets">
                  <Button variant="ghost" size="sm" label="← All Tickets" />
                </Link>
                <Text color="secondary">·</Text>
                <Badge variant="neutral">Ticket #{ticket.number}</Badge>
                <Badge variant={statusVariant(ticket.status)}>
                  {ticket.status?.replaceAll('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant={priorityVariant(ticket.priority)}>
                  {ticket.priority?.toUpperCase()}
                </Badge>
                {blockers.length > 0 && (
                  <Badge variant="error">
                    {blockers.length} Blocker{blockers.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </HStack>

              <HStack gap={2}>
                <Button
                  variant="secondary"
                  size="sm"
                  label={copyFeedback ? 'Copied!' : 'Copy Info'}
                  onClick={handleCopyMarkdown}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  label="Delete"
                  onClick={handleDeleteTicket}
                />
              </HStack>
            </HStack>

            {/* Title Row */}
            {isEditingTitle ? (
              <VStack gap={2}>
                <TextInput
                  label="Ticket Title"
                  isLabelHidden
                  value={titleDraft}
                  onChange={setTitleDraft}
                />
                <HStack gap={2}>
                  <Button variant="primary" size="sm" label="Save Title" onClick={saveTitle} />
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
              <HStack gap={2} vAlign="center">
                <Heading level={1} style={{ margin: 0 }}>
                  {ticket.title}
                </Heading>
                <Button
                  variant="ghost"
                  size="sm"
                  label="Edit"
                  onClick={() => setIsEditingTitle(true)}
                />
              </HStack>
            )}

            {/* Subtitle / Metadata row */}
            <HStack gap={2} vAlign="center" color="secondary" wrap="wrap">
              <Text size="xs">
                Created by <strong>@{ticket.creator_username || 'unknown'}</strong> · {timeAgo(ticket.created_at)}
              </Text>
              {ticket.sprint_name && (
                <>
                  <Text size="xs">·</Text>
                  <Text size="xs">Sprint: <strong>{ticket.sprint_name}</strong></Text>
                </>
              )}
              {linkedRepos.length > 0 && (
                <>
                  <Text size="xs">·</Text>
                  <Text size="xs">{linkedRepos.length} repository linked</Text>
                </>
              )}
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <HStack gap={6} align="start" wrap="wrap">
            {/* Left Content Area (65%) */}
            <VStack gap={6} style={{ flex: 1, minWidth: 340 }}>
              {/* Description Card with Rich Text Markdown & Image Support */}
              <Card p={5} variant="subtle">
                <VStack gap={3}>
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <Heading level={3} style={{ margin: 0 }}>Description</Heading>
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
                    <VStack gap={3}>
                      <MarkdownRichEditor
                        value={descDraft}
                        onChange={setDescDraft}
                        ticketId={ticket.id}
                        placeholder="Add ticket details, acceptance criteria, or paste images..."
                        minRows={6}
                      />
                      <HStack gap={2} justify="end">
                        <Button
                          variant="primary"
                          size="sm"
                          label="Save Description"
                          onClick={saveDescription}
                        />
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

              {/* Blockers & Dependencies Section */}
              <Card p={5} variant="subtle">
                <VStack gap={4}>
                  {/* Blocked by (Dependencies) */}
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center" justify="space-between">
                      <HStack gap={2} vAlign="center">
                        <WarningIcon weight="bold" style={{ color: 'var(--color-status-warning)' }} />
                        <Heading level={3} style={{ margin: 0, fontSize: '1.1rem' }}>
                          Blocked By ({blockers.length})
                        </Heading>
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
                            placeholder="Type ticket title or #number to search…"
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
                          <Card key={b.id} p={3} variant="standard">
                            <HStack gap={2} vAlign="center" justify="space-between">
                              <HStack gap={2} vAlign="center">
                                <StatusDot variant={statusVariant(b.status)} />
                                <Link href={`/ticket/${b.number}`}>
                                  <Text size="sm" weight="semibold">
                                    #{b.number} {b.title}
                                  </Text>
                                </Link>
                                <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                              </HStack>
                              <Button
                                variant="ghost"
                                size="sm"
                                label="Remove"
                                onClick={() => handleRemoveBlocker(b.id)}
                              />
                            </HStack>
                          </Card>
                        ))}
                      </VStack>
                    )}
                  </VStack>

                  <Divider />

                  {/* Unblocks (Dependent Tickets) */}
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center">
                      <CheckCircleIcon weight="bold" style={{ color: 'var(--color-status-success)' }} />
                      <Heading level={3} style={{ margin: 0, fontSize: '1.1rem' }}>
                        Blocks ({unblocks.length})
                      </Heading>
                    </HStack>
                    {unblocks.length === 0 ? (
                      <Text size="xs" color="secondary">Not blocking any other tickets.</Text>
                    ) : (
                      <VStack gap={2}>
                        {unblocks.map((u) => (
                          <Card key={u.id} p={3} variant="standard">
                            <HStack gap={2} vAlign="center" justify="space-between">
                              <HStack gap={2} vAlign="center">
                                <StatusDot variant={statusVariant(u.status)} />
                                <Link href={`/ticket/${u.number}`}>
                                  <Text size="sm" weight="semibold">
                                    #{u.number} {u.title}
                                  </Text>
                                </Link>
                                <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                              </HStack>
                            </HStack>
                          </Card>
                        ))}
                      </VStack>
                    )}
                  </VStack>
                </VStack>
              </Card>

              {/* Tabbed Activity & Discussion */}
              <VStack gap={4}>
                <TabList value={activeTab} onChange={setActiveTab} size="md">
                  <Tab value="comments" label={`Comments (${comments.length})`} />
                  <Tab value="activity" label={`Activity (${ticket.events?.length || 0})`} />
                  <Tab value="git" label={`GitHub Links (${prs.length + commits.length})`} />
                </TabList>

                {/* Comments Thread */}
                {activeTab === 'comments' && (
                  <VStack gap={4}>
                    {comments.length === 0 ? (
                      <Card p={4} variant="subtle">
                        <Text size="sm" color="secondary">
                          No comments yet. Post the first update or comment below.
                        </Text>
                      </Card>
                    ) : (
                      comments.map((c) => (
                        <Card key={c.id} p={4} variant="subtle">
                          <VStack gap={2}>
                            <HStack gap={2} vAlign="center" justify="space-between">
                              <HStack gap={2} vAlign="center">
                                <Avatar name={c.author_username || 'User'} size="sm" />
                                <Text size="sm" weight="semibold">@{c.author_username}</Text>
                                <Text size="xs" color="secondary">{timeAgo(c.created_at)}</Text>
                              </HStack>
                              {(currentUser?.role === 'admin' || currentUser?.id === c.author_id) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  label="Delete"
                                  onClick={() => handleDeleteComment(c.id)}
                                />
                              )}
                            </HStack>
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                              {c.content}
                            </Text>
                          </VStack>
                        </Card>
                      ))
                    )}

                    {/* New Comment Input */}
                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <Heading level={4} size="sm">Add Comment</Heading>
                        <TextArea
                          label="Write comment"
                          isLabelHidden
                          value={newComment}
                          onChange={setNewComment}
                          placeholder="Type comment or markdown..."
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
                    </Card>
                  </VStack>
                )}

                {/* Activity Feed */}
                {activeTab === 'activity' && (
                  <Card p={4} variant="subtle">
                    <VStack gap={3}>
                      {(ticket.events || []).length === 0 ? (
                        <Text size="sm" color="secondary">No activity events recorded.</Text>
                      ) : (
                        ticket.events.map((evt, idx) => (
                          <HStack key={idx} gap={2} vAlign="center">
                            <StatusDot variant="neutral" />
                            <Text size="xs">
                              <strong>@{evt.actor_username || 'System'}</strong> {evt.action || 'updated ticket'} · {timeAgo(evt.created_at)}
                            </Text>
                          </HStack>
                        ))
                      )}
                    </VStack>
                  </Card>
                )}

                {/* GitHub PRs and Commits */}
                {activeTab === 'git' && (
                  <VStack gap={4}>
                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <Heading level={3} style={{ margin: 0 }}>Linked Pull Requests</Heading>
                        {prs.length === 0 ? (
                          <Text size="xs" color="secondary">No GitHub pull requests linked to this ticket.</Text>
                        ) : (
                          prs.map((pr) => (
                            <HStack key={pr.id} gap={2} vAlign="center" justify="space-between">
                              <HStack gap={2} vAlign="center">
                                <Badge variant={pr.state === 'open' ? 'success' : 'neutral'}>
                                  #{pr.number}
                                </Badge>
                                <Text size="sm" weight="medium">{pr.title}</Text>
                              </HStack>
                              <HStack gap={2} vAlign="center">
                                <Text size="xs" color="secondary">{pr.repo_owner}/{pr.repo_name}</Text>
                                {pr.html_url && (
                                  <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="sm" label="GitHub ↗" />
                                  </a>
                                )}
                              </HStack>
                            </HStack>
                          ))
                        )}
                      </VStack>
                    </Card>

                    <Card p={4} variant="subtle">
                      <VStack gap={3}>
                        <Heading level={3} style={{ margin: 0 }}>Linked Commits</Heading>
                        {commits.length === 0 ? (
                          <Text size="xs" color="secondary">No GitHub commits linked to this ticket.</Text>
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
                    </Card>
                  </VStack>
                )}
              </VStack>
            </VStack>

            {/* Right Sidebar Metadata Panel (35%) */}
            <Card p={5} variant="subtle" style={{ width: 340, flexShrink: 0 }}>
              <VStack gap={5}>
                {/* Linked Repositories */}
                <VStack gap={2}>
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <HStack gap={1} vAlign="center">
                      <GitBranchIcon weight="bold" />
                      <Heading level={3} style={{ margin: 0, fontSize: '1rem' }}>Repositories</Heading>
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

                {/* Pull Requests: Specific link, auto-detection, recent PRs */}
                <TicketPullRequestsSection
                  ticketId={ticket.id}
                  ticketNumber={ticket.number}
                  ticketRepositories={linkedRepos}
                  allRepositories={allRepositories}
                  onChanged={fetchTicket}
                />

                <Divider />

                {/* Labels */}
                <VStack gap={2}>
                  <HStack gap={2} vAlign="center" justify="space-between">
                    <HStack gap={1} vAlign="center">
                      <TagIcon weight="bold" />
                      <Heading level={3} style={{ margin: 0, fontSize: '1rem' }}>Labels</Heading>
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

                <Divider />

                {/* Attributes Metadata */}
                <Heading level={3} style={{ margin: 0, fontSize: '1rem' }}>Attributes</Heading>

                <MetadataList label={{ position: 'top' }}>
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
                      />
                    </HStack>
                  </MetadataListItem>

                  {/* Priority */}
                  <MetadataListItem label="Priority">
                    <HStack gap={2} vAlign="center">
                      <Badge variant={priorityVariant(ticket.priority)}>
                        {ticket.priority?.toUpperCase()}
                      </Badge>
                      <Selector
                        label="Priority"
                        isLabelHidden
                        value={ticket.priority || 'medium'}
                        onChange={(val) => updateField('priority', val)}
                        options={PRIORITY_OPTIONS}
                      />
                    </HStack>
                  </MetadataListItem>

                  {/* Assignee */}
                  <MetadataListItem label="Assignee">
                    <HStack gap={2} vAlign="center">
                      <Avatar name={ticket.assignee_username || 'Unassigned'} size="sm" />
                      <Selector
                        label="Assignee"
                        isLabelHidden
                        value={ticket.assignee_id ? String(ticket.assignee_id) : 'unassigned'}
                        onChange={(val) => updateField('assignee_id', val === 'unassigned' ? null : val)}
                        options={assigneeOptions}
                      />
                    </HStack>
                  </MetadataListItem>

                  {/* Sprint */}
                  <MetadataListItem label="Sprint">
                    <Selector
                      label="Sprint"
                      isLabelHidden
                      value={ticket.sprint_id ? String(ticket.sprint_id) : 'none'}
                      onChange={(val) => updateField('sprint_id', val === 'none' ? null : val)}
                      options={sprintOptions}
                    />
                  </MetadataListItem>

                  {/* Story Points */}
                  <MetadataListItem label="Story Points">
                    <HStack gap={2}>
                      <TextInput
                        label="Total Points"
                        type="number"
                        value={ticket.total_points != null ? String(ticket.total_points) : ''}
                        onChange={(val) => updateField('total_points', val ? parseInt(val, 10) : null)}
                        placeholder="Total"
                      />
                      <TextInput
                        label="Remaining"
                        type="number"
                        value={ticket.points_remaining != null ? String(ticket.points_remaining) : ''}
                        onChange={(val) => updateField('points_remaining', val ? parseInt(val, 10) : null)}
                        placeholder="Remain"
                      />
                    </HStack>
                  </MetadataListItem>

                  {/* Due Date */}
                  <MetadataListItem label="Due Date">
                    <TextInput
                      label="Due Date"
                      isLabelHidden
                      type="date"
                      value={ticket.due_date ? ticket.due_date.split('T')[0] : ''}
                      onChange={(val) => updateField('due_date', val || null)}
                    />
                  </MetadataListItem>
                </MetadataList>

                <Divider />

                <VStack gap={1}>
                  <Text size="xs" color="secondary">
                    Created: {ticket.created_at ? ticket.created_at.split('T')[0] : '—'}
                  </Text>
                  {ticket.updated_at && (
                    <Text size="xs" color="secondary">
                      Updated: {ticket.updated_at.split('T')[0]}
                    </Text>
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
