'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { PRIORITIES, STATUSES, ticketRules } from '@/lib/constants';
import { parseTimestamp, timeAgo } from '@/lib/dates';
import { uploadPastedImage } from '@/lib/description-paste';
import { uploadImageFiles } from '@/lib/upload-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ActivityIcon,
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarBlankIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  CircleIcon,
  FireIcon,
  FlagIcon,
  GitCommitIcon,
  GitForkIcon,
  GitPullRequestIcon,
  KanbanIcon,
  LinkIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  RocketLaunchIcon,
  SpinnerGapIcon,
  TagIcon,
  TrashIcon,
  TimerIcon,
  UserCircleIcon,
  UsersIcon,
  XIcon,
} from '@phosphor-icons/react';
import CommentThread from './CommentThread';
import { useRealtime } from '@/lib/realtime';
import DescriptionPreview from './DescriptionPreview';
import DependencyPicker from './DependencyPicker';
import ImageUploadButton from './ImageUploadButton';
import LabelPicker from './LabelPicker';

const STATUS_ICONS = {
  backlog: KanbanIcon,
  todo: CircleIcon,
  in_progress: SpinnerGapIcon,
  in_review: TimerIcon,
  done: RocketLaunchIcon,
};

const PRIORITY_ICONS = {
  low: ArrowDownIcon,
  medium: FlagIcon,
  high: ArrowUpIcon,
  urgent: FireIcon,
};

export default function TicketDetail({ ticketId, initialEditing = false, onClose }) {
  const [activeTicketId, setActiveTicketId] = useState(ticketId);
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [totalPointsInput, setTotalPointsInput] = useState('');
  const [pointsRemainingInput, setPointsRemainingInput] = useState('');
  const attachFileRef = useRef(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [relatedCommits, setRelatedCommits] = useState([]);
  const [commitPickerOpen, setCommitPickerOpen] = useState(false);
  const [commitOptions, setCommitOptions] = useState([]);
  const [commitSearch, setCommitSearch] = useState('');
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitSyncing, setCommitSyncing] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [relatedPrs, setRelatedPrs] = useState([]);
  const [prPickerOpen, setPrPickerOpen] = useState(false);
  const [prOptions, setPrOptions] = useState([]);
  const [prSearch, setPrSearch] = useState('');
  const [prLoading, setPrLoading] = useState(false);
  const [prSyncing, setPrSyncing] = useState(false);
  const [prError, setPrError] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [pendingStatus, setPendingStatus] = useState(null);

  async function fetchTicket({ preserveDraft = isEditing } = {}) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}`);
    const data = await res.json();
    if (data.ticket) {
      setTicket(data.ticket);
      if (!preserveDraft || !ticket || ticket.id !== data.ticket.id) {
        setTitle(data.ticket.title);
        setDescription(data.ticket.description);
        setOriginalTitle(data.ticket.title);
        setOriginalDescription(data.ticket.description);
      }
      setEvents(data.ticket.events || []);
      setTotalPointsInput(data.ticket.total_points != null ? String(data.ticket.total_points) : '');
      setPointsRemainingInput(data.ticket.points_remaining != null ? String(data.ticket.points_remaining) : '');
    }
  }

  async function navigateToTicketNumber(number) {
    const res = await apiFetch(`/api/search?q=${number}`);
    const data = await res.json();
    const match = (data.results || []).find((t) => t.number === number);
    if (match) setActiveTicketId(match.id);
  }

  async function fetchComments() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
  }

  async function fetchRelatedCommits() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`);
    const data = await res.json();
    setRelatedCommits(data.commits || []);
  }

  async function fetchRelatedPrs() {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/prs`);
    const data = await res.json();
    setRelatedPrs(data.prs || []);
  }

  async function fetchCurrentUser() {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user || null);
    }
  }

  useEffect(() => {
    setActiveTicketId(ticketId);
    setIsEditing(initialEditing);
  }, [ticketId, initialEditing]);

  useEffect(() => {
    fetchTicket();
    fetchComments();
    fetchRelatedCommits();
    fetchRelatedPrs();
    fetchCurrentUser();
    apiFetch('/api/users').then((r) => r.json()).then((d) => setUsers(d.users || []));
    apiFetch('/api/sprints').then((r) => r.json()).then((d) => setSprints(d.sprints || []));
    apiFetch('/api/github/repositories').then((r) => r.json()).then((d) => setRepositories(d.repositories || []));
  }, [activeTicketId]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose({ updated: true });
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useRealtime((event) => {
    if (event.kind === 'ticket' && event.id === activeTicketId) fetchTicket();
    if (event.kind === 'comment' && event.ticket_id === activeTicketId) fetchComments();
  });

  function startEditing() {
    setOriginalTitle(title);
    setOriginalDescription(description);
    setIsEditing(true);
  }

  async function updateField(field, value) {
    const nextValue = ['sprint_id', 'assignee_id', 'github_repo_id'].includes(field) ? value || null : value;
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: nextValue }),
    });
    if (res.ok) {
      fetchTicket();
      fetchComments();
      if (field === 'github_repo_id') {
        setRelatedCommits([]);
        setCommitOptions([]);
        setCommitPickerOpen(false);
        setRelatedPrs([]);
        setPrOptions([]);
        setPrPickerOpen(false);
      }
    }
  }

  async function updateAssignees(nextAssigneeIds) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_ids: nextAssigneeIds }),
    });
    if (res.ok) {
      fetchTicket();
      fetchComments();
    }
  }

  async function updateReviewers(nextReviewerIds) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer_ids: nextReviewerIds }),
    });
    if (res.ok) {
      fetchTicket();
      fetchComments();
    }
  }

  function toggleAssignee(userId) {
    const current = new Set((ticket.assignees || []).map((assignee) => assignee.id));
    if (current.has(userId)) current.delete(userId);
    else current.add(userId);
    updateAssignees([...current]);
  }

  function toggleReviewer(userId) {
    const current = new Set((ticket.reviewers || []).map((reviewer) => reviewer.id));
    if (current.has(userId)) current.delete(userId);
    else current.add(userId);
    updateReviewers([...current]);
  }

  function handleStatusChange(value) {
    if (ticket.status === 'in_progress' && ['in_review', 'done'].includes(value) && !relatedCommits.length) {
      setPendingStatus(value);
      return;
    }
    updateField('status', value);
  }

  async function moveWithoutCommit() {
    const value = pendingStatus;
    setPendingStatus(null);
    if (value) await updateField('status', value);
  }

  async function moveAndOpenCommits() {
    const value = pendingStatus;
    setPendingStatus(null);
    if (value) await updateField('status', value);
    setActiveTab('commits');
    setCommitPickerOpen(true);
    fetchCommitOptions();
  }

  async function finishEditing() {
    const titleChanged = title !== originalTitle;
    const descriptionChanged = description !== originalDescription;

    if (titleChanged || descriptionChanged) {
      const patch = {};
      if (titleChanged) patch.title = title;
      if (descriptionChanged) patch.description = description;
      const res = await apiFetch(`/api/tickets/${activeTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.ticket) {
          setTicket(data.ticket);
          setTitle(data.ticket.title);
          setDescription(data.ticket.description);
          setOriginalTitle(data.ticket.title);
          setOriginalDescription(data.ticket.description);
          setEvents(data.ticket.events || []);
        } else {
          await fetchTicket({ preserveDraft: false });
        }
        fetchComments();
      }
    }

    setIsEditing(false);
  }

  function cancelEditing() {
    setTitle(originalTitle);
    setDescription(originalDescription);
    setIsEditing(false);
  }

  function descriptionWithMarkdown(markdown, target = null) {
    const start = target?.selectionStart ?? description.length;
    const end = target?.selectionEnd ?? description.length;
    const prefix = description.slice(0, start).replace(/\s*$/, '\n\n');
    const suffix = description.slice(end).replace(/^\s*/, '\n');
    return `${prefix}${markdown.trim()}${suffix}`;
  }

  async function appendDescriptionImage(markdown) {
    const nextDescription = `${description.trimEnd()}\n\n${markdown.trim()}\n`;
    setDescription(nextDescription);
    await updateField('description', nextDescription);
    await fetchTicket();
  }

  async function insertDescriptionImage(markdown, target) {
    const nextDescription = descriptionWithMarkdown(markdown, target);
    setDescription(nextDescription);
    await updateField('description', nextDescription);
    await fetchTicket();
  }

  function handleDescriptionPaste(e) {
    const target = e.currentTarget;
    uploadPastedImage(e, (markdown) => insertDescriptionImage(markdown, target), { ticketId: activeTicketId });
  }

  async function removeDependency(dependsOnId) {
    await apiFetch(`/api/tickets/${activeTicketId}/dependencies`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_id: dependsOnId }),
    });
    fetchTicket();
  }

  async function deleteTicket() {
    if (!confirm('Delete this ticket?')) return;
    const res = await apiFetch(`/api/tickets/${activeTicketId}`, { method: 'DELETE' });
    if (res.ok) onClose({ deleted: true });
  }

  async function toggleWatcher() {
    if (!currentUser) return;
    const isWatching = ticket.watchers?.some((w) => w.id === currentUser.id);
    if (isWatching) {
      await apiFetch(`/api/tickets/${activeTicketId}/watchers/${currentUser.id}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/tickets/${activeTicketId}/watchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    }
    fetchTicket();
  }

  async function removeWatcher(userId) {
    await apiFetch(`/api/tickets/${activeTicketId}/watchers/${userId}`, { method: 'DELETE' });
    fetchTicket();
  }

  async function handleAttachFile(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setAttachUploading(true);
    try {
      await uploadImageFiles(files, { ticketId: activeTicketId });
      fetchTicket();
    } catch (err) {
      alert(err.message);
    } finally {
      setAttachUploading(false);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resolveEventValue(field, value) {
    if (!value) return '(none)';
    if (field === 'assignee') {
      return users.find((u) => u.id === value)?.username || value;
    }
    if (field === 'sprint') {
      return sprints.find((s) => s.id === value)?.name || value;
    }
    if (field === 'repository') {
      const repo = repositories.find((r) => r.id === value);
      return repo ? repo.full_name : value;
    }
    return value;
  }

  async function fetchCommitOptions(search = commitSearch) {
    if (!ticket.github_repo_id) return;
    setCommitError('');
    setCommitLoading(true);
    const params = new URLSearchParams({ ticket_id: activeTicketId, limit: '100' });
    if (search) params.set('q', search);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/commits?${params.toString()}`);
    const data = await res.json();
    setCommitLoading(false);
    if (!res.ok) {
      setCommitError(data.error || 'Failed to load commits.');
      return;
    }
    setCommitOptions(data.commits || []);
  }

  async function syncCommits() {
    if (!ticket.github_repo_id) return;
    setCommitError('');
    setCommitSyncing(true);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/sync-commits`, { method: 'POST' });
    const data = await res.json();
    setCommitSyncing(false);
    if (!res.ok) {
      setCommitError(data.error || 'Failed to refresh commits.');
      return;
    }
    fetchCommitOptions();
  }

  async function linkCommit(sha) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCommitError(data.error || 'Failed to link commit.');
      return;
    }
    setRelatedCommits(data.commits || []);
    fetchCommitOptions();
  }

  async function unlinkCommit(sha) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/commits`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    });
    if (res.ok) {
      setRelatedCommits((prev) => prev.filter((commit) => commit.sha !== sha));
      fetchCommitOptions();
    }
  }

  async function fetchPrOptions(search = prSearch) {
    if (!ticket.github_repo_id) return;
    setPrError('');
    setPrLoading(true);
    const params = new URLSearchParams({ ticket_id: activeTicketId, limit: '100' });
    if (search) params.set('q', search);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/prs?${params.toString()}`);
    const data = await res.json();
    setPrLoading(false);
    if (!res.ok) {
      setPrError(data.error || 'Failed to load pull requests.');
      return;
    }
    setPrOptions(data.prs || []);
  }

  async function syncPrs() {
    if (!ticket.github_repo_id) return;
    setPrError('');
    setPrSyncing(true);
    const res = await apiFetch(`/api/github/repositories/${ticket.github_repo_id}/sync-prs`, { method: 'POST' });
    const data = await res.json();
    setPrSyncing(false);
    if (!res.ok) {
      setPrError(data.error || 'Failed to refresh pull requests.');
      return;
    }
    fetchPrOptions();
  }

  async function linkPr(prNumber) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/prs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_number: prNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPrError(data.error || 'Failed to link pull request.');
      return;
    }
    setRelatedPrs(data.prs || []);
    fetchPrOptions();
    fetchTicket();
  }

  async function unlinkPr(prNumber) {
    const res = await apiFetch(`/api/tickets/${activeTicketId}/prs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_number: prNumber }),
    });
    if (res.ok) {
      setRelatedPrs((prev) => prev.filter((pr) => pr.number !== prNumber));
      fetchPrOptions();
    }
  }

  function firstLine(message) {
    return (message || '').split('\n')[0];
  }

  function branchText(commit) {
    const branches = commit.branches || [];
    if (!branches.length) return '';
    if (branches.length <= 2) return branches.join(', ');
    return `${branches.slice(0, 2).join(', ')} +${branches.length - 2}`;
  }

  function dateFromToday(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (!ticket) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="ticket-detail-dialog-modern" showCloseButton={false}>
          <div className="ticket-detail-skeleton">
            <div className="ticket-detail-skeleton-header">
              <div className="td-skel-row" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div className="td-skel-pill" style={{ width: 48 }} />
                <div className="td-skel-pill" style={{ width: 72 }} />
                <div className="td-skel-pill" style={{ width: 56 }} />
              </div>
              <div className="td-skel-line" style={{ width: '55%', height: 24, marginBottom: '0.5rem' }} />
              <div className="td-skel-line" style={{ width: '35%', height: 16 }} />
            </div>
            <div className="ticket-detail-layout" style={{ flex: 1, minHeight: 0 }}>
              <div className="ticket-detail-main" style={{ gap: '1.25rem' }}>
                <div className="td-skel-line" style={{ width: '100%', height: 12 }} />
                <div className="td-skel-line" style={{ width: '90%', height: 12 }} />
                <div className="td-skel-line" style={{ width: '75%', height: 12 }} />
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="td-skel-line" style={{ width: '100%', height: 12, marginBottom: '0.5rem' }} />
                  <div className="td-skel-line" style={{ width: '85%', height: 12, marginBottom: '0.5rem' }} />
                  <div className="td-skel-line" style={{ width: '60%', height: 12 }} />
                </div>
              </div>
              <div className="ticket-detail-sidebar-modern" style={{ gap: '1rem' }}>
                {[80, 60, 70, 50, 65].map((w, i) => (
                  <div key={i}>
                    <div className="td-skel-line" style={{ width: '40%', height: 10, marginBottom: '0.4rem' }} />
                    <div className="td-skel-line" style={{ width: `${w}%`, height: 14 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const sprintName = ticket.sprint_id
    ? sprints.find((sprint) => sprint.id === ticket.sprint_id)?.name || 'Current sprint'
    : 'No sprint';
  const sprintEndDate = ticket.sprint_id ? sprints.find((s) => s.id === ticket.sprint_id)?.end_date : null;
  const assignees = ticket.assignees?.length
    ? ticket.assignees
    : ticket.assignee_id
      ? [{ id: ticket.assignee_id, username: ticket.assignee_username }]
      : [];
  const HeaderStatusIcon = STATUS_ICONS[ticket.status] || CircleIcon;
  const HeaderPriorityIcon = PRIORITY_ICONS[ticket.priority] || FlagIcon;
  const inSprint = !!ticket.sprint_id;
  const inBacklog = ticket.status === 'backlog';
  const canAssign = ticketRules.canAssign(ticket.status);
  const canReview = ticketRules.canHaveReviewers(ticket.status);

  // Merge events and comments for the activity section
  const activityItems = [
    ...events.map((e) => ({ ...e, _type: 'event' })),
    ...comments.map((c) => ({ ...c, _type: 'comment' })),
  ].sort((a, b) => parseTimestamp(a.created_at) - parseTimestamp(b.created_at));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose({ updated: true }); }}>
      <DialogContent className="ticket-detail-dialog-modern" showCloseButton={false}>
        <DialogHeader className="ticket-detail-header">
          <div className="ticket-detail-title-block">
            <div className="ticket-detail-kicker">
              <Badge variant="outline">#{ticket.number}</Badge>
              <Badge className={`status-badge status-badge-${ticket.status}`} variant="outline">
                <HeaderStatusIcon weight="bold" />
                {ticket.status.replaceAll('_', ' ')}
              </Badge>
              {ticket.priority && (
                <Badge className={`priority-badge priority-badge-${ticket.priority}`} variant="outline">
                  <HeaderPriorityIcon weight="bold" />
                  {ticket.priority}
                </Badge>
              )}
            </div>
            <DialogTitle asChild>
              <div>
                {isEditing ? (
                  <Input
                    className="ticket-detail-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <h2 className="ticket-detail-title-view">{ticket.title}</h2>
                )}
              </div>
            </DialogTitle>
          </div>
          <div className="ticket-detail-actions">
            {isEditing ? (
              <>
                <Button type="button" size="sm" className="tickets-new-button" onClick={finishEditing}>
                  <CheckCircleIcon weight="bold" />
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={cancelEditing}>Cancel</Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={startEditing}>
                <PencilSimpleIcon weight="bold" />
                Edit title and description
              </Button>
            )}
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => onClose({ updated: true })}>
              <XIcon weight="bold" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="ticket-detail-layout">
          <main className="ticket-detail-main">
            <section className="ticket-detail-section">
              <div className="ticket-detail-section-header">
                <div>
                  <h3>Description</h3>
                  <p>Markdown, screenshots, and acceptance criteria live here.</p>
                </div>
                {isEditing && <ImageUploadButton ticketId={activeTicketId} onUploaded={appendDescriptionImage} />}
              </div>
              {isEditing ? (
                <div className="ticket-description-editor">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onPaste={handleDescriptionPaste}
                    rows={12}
                  />
                  <DescriptionPreview value={description} />
                </div>
              ) : (
                <DescriptionPreview value={ticket.description || ''} className="ticket-description-preview" />
              )}
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="ticket-detail-tabs">
              <TabsList className="ticket-detail-tabs-list">
                <TabsTrigger value="comments"><ChatCircleTextIcon weight="bold" />Comments</TabsTrigger>
                <TabsTrigger value="activity"><ActivityIcon weight="bold" />Activity</TabsTrigger>
                <TabsTrigger value="commits"><GitCommitIcon weight="bold" />Commits</TabsTrigger>
                <TabsTrigger value="prs"><GitPullRequestIcon weight="bold" />PRs</TabsTrigger>
                <TabsTrigger value="attachments"><PaperclipIcon weight="bold" />Attachments</TabsTrigger>
              </TabsList>

              <TabsContent value="comments">
                <section className="ticket-detail-section">
                  <CommentThread
                    ticketId={activeTicketId}
                    comments={comments}
                    currentUser={currentUser}
                    users={users}
                    onTicketRef={navigateToTicketNumber}
                    onAdded={(comment) => setComments((prev) => [...prev, comment])}
                    onDeleted={(commentId) =>
                      setComments((prev) =>
                        prev.map((c) =>
                          c.id === commentId
                            ? { ...c, deleted_at: new Date().toISOString(), deleted_by_username: currentUser?.username }
                            : c
                        )
                      )
                    }
                  />
                </section>
              </TabsContent>

              <TabsContent value="activity">
                <section className="ticket-detail-section">
                  <div className="ticket-activity-list">
                    {activityItems.filter((item) => item._type === 'event').length === 0 && (
                      <div className="ticket-detail-empty">No recent activity.</div>
                    )}
                    {activityItems.map((item) => {
                      if (item._type === 'event' && item.kind === 'field_change') {
                        return (
                          <div className="event-row" key={item.id}>
                            <ActivityIcon weight="bold" />
                            <span>
                              <strong>{item.actor_username}</strong> changed {item.field}
                              {item.field !== 'description' && <> from {resolveEventValue(item.field, item.old_value)} to {resolveEventValue(item.field, item.new_value)}</>}
                            </span>
                            <span className="comment-date">{timeAgo(item.created_at)}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="commits">
                <section className="ticket-detail-section">
                  <div className="ticket-detail-section-header">
                    <div>
                      <h3>Related commits</h3>
                      <p>Link repository work back to this issue.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!ticket.github_repo_id}
                      onClick={() => {
                        const nextOpen = !commitPickerOpen;
                        setCommitPickerOpen(nextOpen);
                        if (nextOpen) fetchCommitOptions();
                      }}
                    >
                      <GitCommitIcon weight="bold" />
                      Link commits
                    </Button>
                  </div>
                  {!ticket.github_repo_id && <div className="ticket-detail-empty">Select a repository before linking commits.</div>}
                  {ticket.github_repo_id && relatedCommits.length === 0 && <div className="ticket-detail-empty">No commits linked.</div>}
                  {relatedCommits.length > 0 && (
                    <ul className="commit-list">
                      {relatedCommits.map((commit) => (
                        <li className="commit-row" key={commit.sha}>
                          <div className="commit-main">
                            <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="text-mono">{commit.short_sha}</a>
                            <span>{firstLine(commit.message)}</span>
                            <span className="text-muted text-sm">{commit.author_login || commit.author_name || 'unknown'} · {timeAgo(commit.committed_at)}</span>
                            {branchText(commit) && <span className="text-muted text-sm">{branchText(commit)}</span>}
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => unlinkCommit(commit.sha)}>Unlink</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {commitPickerOpen && ticket.github_repo_id && (
                    <div className="label-picker-dropdown commit-picker">
                      <div className="ticket-detail-inline-controls">
                        <Input
                          type="search"
                          value={commitSearch}
                          onChange={(e) => setCommitSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchCommitOptions(commitSearch);
                          }}
                          placeholder="Search commits"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={() => fetchCommitOptions(commitSearch)} disabled={commitLoading}>Search</Button>
                        <Button type="button" size="sm" variant="outline" onClick={syncCommits} disabled={commitSyncing}>
                          {commitSyncing ? 'Refreshing...' : 'Refresh from GitHub'}
                        </Button>
                      </div>
                      {commitError && <div className="form-error">{commitError}</div>}
                      {commitLoading && <div className="ticket-detail-empty">Loading commits...</div>}
                      {!commitLoading && commitOptions.length === 0 && <div className="ticket-detail-empty">No cached commits.</div>}
                      {!commitLoading && commitOptions.length > 0 && (
                        <ul className="commit-list">
                          {commitOptions.map((commit) => (
                            <li className="commit-row" key={commit.sha}>
                              <div className="commit-main">
                                <span className="text-mono">{commit.short_sha}</span>
                                <span>{firstLine(commit.message)}</span>
                                <span className="text-muted text-sm">{commit.author_login || commit.author_name || 'unknown'} · {timeAgo(commit.committed_at)}</span>
                                {branchText(commit) && <span className="text-muted text-sm">{branchText(commit)}</span>}
                              </div>
                              <Button type="button" size="sm" variant="outline" disabled={commit.linked} onClick={() => linkCommit(commit.sha)}>
                                {commit.linked ? 'Linked' : 'Link'}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="prs">
                <section className="ticket-detail-section">
                  <div className="ticket-detail-section-header">
                    <div>
                      <h3>Related pull requests</h3>
                      <p>Link pull requests back to this issue.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!ticket.github_repo_id}
                      onClick={() => {
                        const nextOpen = !prPickerOpen;
                        setPrPickerOpen(nextOpen);
                        if (nextOpen) fetchPrOptions();
                      }}
                    >
                      <GitPullRequestIcon weight="bold" />
                      Link pull request
                    </Button>
                  </div>
                  {!ticket.github_repo_id && <div className="ticket-detail-empty">Select a repository before linking pull requests.</div>}
                  {ticket.github_repo_id && relatedPrs.length === 0 && <div className="ticket-detail-empty">No pull requests linked.</div>}
                  {relatedPrs.length > 0 && (
                    <ul className="commit-list">
                      {relatedPrs.map((pr) => (
                        <li className="commit-row" key={pr.number}>
                          <div className="commit-main">
                            <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-mono">#{pr.number}</a>
                            <span>{pr.title}</span>
                            <span className="text-muted text-sm">@{pr.author_login || 'unknown'} · state: {pr.state} · {timeAgo(pr.created_at)}</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => unlinkPr(pr.number)}>Unlink</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {prPickerOpen && ticket.github_repo_id && (
                    <div className="label-picker-dropdown commit-picker">
                      <div className="ticket-detail-inline-controls">
                        <Input
                          type="search"
                          value={prSearch}
                          onChange={(e) => setPrSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchPrOptions(prSearch);
                          }}
                          placeholder="Search pull requests"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={() => fetchPrOptions(prSearch)} disabled={prLoading}>Search</Button>
                        <Button type="button" size="sm" variant="outline" onClick={syncPrs} disabled={prSyncing}>
                          {prSyncing ? 'Refreshing...' : 'Refresh from GitHub'}
                        </Button>
                      </div>
                      {prError && <div className="form-error">{prError}</div>}
                      {prLoading && <div className="ticket-detail-empty">Loading pull requests...</div>}
                      {!prLoading && prOptions.length === 0 && <div className="ticket-detail-empty">No open pull requests.</div>}
                      {!prLoading && prOptions.length > 0 && (
                        <ul className="commit-list">
                          {prOptions.map((pr) => (
                            <li className="commit-row" key={pr.number}>
                              <div className="commit-main">
                                <span className="text-mono">#{pr.number}</span>
                                <span>{pr.title}</span>
                                <span className="text-muted text-sm">@{pr.author_login || 'unknown'} · {timeAgo(pr.created_at)}</span>
                              </div>
                              <Button type="button" size="sm" variant="outline" disabled={pr.linked} onClick={() => linkPr(pr.number)}>
                                {pr.linked ? 'Linked' : 'Link'}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="attachments">
                <section className="ticket-detail-section">
                  <div className="ticket-detail-section-header">
                    <div>
                      <h3>Attachments</h3>
                      <p>Upload screenshots or supporting files for the team.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={attachUploading}
                      onClick={() => attachFileRef.current?.click()}
                    >
                      <PaperclipIcon weight="bold" />
                      {attachUploading ? 'Uploading...' : 'Attach file'}
                    </Button>
                  </div>
                  <input
                    ref={attachFileRef}
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    multiple
                    onChange={handleAttachFile}
                  />
                  {!ticket.attachments?.length && <div className="ticket-detail-empty">No attachments yet.</div>}
                  {ticket.attachments?.length > 0 && (
                    <ul className="ticket-attachment-list">
                      {ticket.attachments.map((att) => (
                        <li key={att.id}>
                          <PaperclipIcon weight="bold" />
                          <a href={att.url} target="_blank" rel="noopener noreferrer">{att.filename}</a>
                          <span>{formatBytes(att.size_bytes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </TabsContent>
            </Tabs>
          </main>

          <aside className="ticket-detail-sidebar-modern">
            <div className="ticket-property-card">
              <div className="ticket-property-header">
                <GitForkIcon weight="bold" />
                Planning
              </div>
              <div className="ticket-property-field">
                <Label>Sprint</Label>
                <Select value={ticket.sprint_id || 'backlog'} onValueChange={(value) => updateField('sprint_id', value === 'backlog' ? '' : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ticket-property-field">
                <Label>Repository</Label>
                <Select value={ticket.github_repo_id || 'none'} onValueChange={(value) => updateField('github_repo_id', value === 'none' ? '' : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repository</SelectItem>
                    {repositories.map((repo) => <SelectItem key={repo.id} value={repo.id}>{repo.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {ticket.github_repository && (
                  <a href={ticket.github_repository.html_url} target="_blank" rel="noopener noreferrer" className="ticket-external-link">
                    <LinkIcon weight="bold" />
                    Open repository
                  </a>
                )}
              </div>
              <div className="ticket-property-field">
                <Label><TagIcon weight="bold" /> Labels</Label>
                <LabelPicker ticketId={activeTicketId} currentLabels={ticket.labels || []} onUpdate={fetchTicket} />
              </div>
            </div>

            <div className="ticket-property-card">
              <div className="ticket-property-header">
                <UserCircleIcon weight="bold" />
                People
              </div>
              <div className="ticket-property-field">
                <Label>Created by</Label>
                <div className="ticket-person-pill">@{ticket.creator_username}</div>
              </div>
              <div className="ticket-property-field">
                <Label>Assignees</Label>
                {canAssign ? (
                  <div className="ticket-assignee-check-list">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="ticket-assignee-check-row"
                        onClick={() => toggleAssignee(user.id)}
                      >
                        <Checkbox checked={assignees.some((assignee) => assignee.id === user.id)} aria-hidden="true" tabIndex={-1} />
                        <span>@{user.username}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="ticket-property-hint">Add this ticket to a sprint before assigning it.</p>
                )}
              </div>
              <div className="ticket-property-field">
                <Label>Reviewers</Label>
                {canReview ? (
                  <div className="ticket-assignee-check-list">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="ticket-assignee-check-row"
                        onClick={() => toggleReviewer(user.id)}
                      >
                        <Checkbox checked={ticket.reviewers?.some((reviewer) => reviewer.id === user.id)} aria-hidden="true" tabIndex={-1} />
                        <span>@{user.username}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="ticket-property-hint">Reviewers can be added once the ticket reaches PR or Prod.</p>
                )}
                {!!ticket.reviewers?.length && (
                  <div className="ticket-pill-list">
                    {ticket.reviewers.map((reviewer) => (
                      <span
                        key={reviewer.id}
                        className="ticket-person-pill"
                        title={reviewer.requested_by_username ? `Requested by ${reviewer.requested_by_username}` : undefined}
                      >
                        @{reviewer.username}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ticket-property-field">
                <Label>Watchers</Label>
                <div className="ticket-pill-list">
                  {ticket.watchers?.map((w) => (
                    <span key={w.id} className="ticket-person-pill ticket-person-pill-removable">
                      @{w.username}
                      {(currentUser?.role === 'admin' || currentUser?.id === w.id) && (
                        <button type="button" onClick={() => removeWatcher(w.id)} aria-label={`Remove ${w.username} as watcher`}>
                          <XIcon weight="bold" />
                        </button>
                      )}
                    </span>
                  ))}
                  {!ticket.watchers?.length && <span className="text-muted">None</span>}
                </div>
                {currentUser && (
                  <Button type="button" size="sm" variant="outline" onClick={toggleWatcher}>
                    <UsersIcon weight="bold" />
                    {ticket.watchers?.some((w) => w.id === currentUser.id) ? 'Unwatch' : 'Watch'}
                  </Button>
                )}
              </div>
            </div>

            <div className="ticket-property-card">
              <div className="ticket-property-header">
                <ArchiveIcon weight="bold" />
                Properties
              </div>
              <div className="ticket-property-field">
                <Label>Status</Label>
                <Select value={ticket.status} onValueChange={handleStatusChange} disabled={inBacklog}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.filter((status) => status.value !== 'backlog' || inBacklog).map((status) => {
                      const StatusIcon = STATUS_ICONS[status.value] || CircleIcon;
                      return (
                        <SelectItem key={status.value} value={status.value}>
                          <span className={`select-icon-option status-option status-option-${status.value}`}>
                            <StatusIcon weight="bold" />
                            {status.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {inBacklog && <p className="ticket-property-hint">Add this ticket to a sprint to start progress.</p>}
              </div>
              <div className="ticket-property-field">
                <Label>Priority</Label>
                <Select value={ticket.priority} onValueChange={(value) => updateField('priority', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => {
                      const PriorityIcon = PRIORITY_ICONS[priority.value] || FlagIcon;
                      return (
                        <SelectItem key={priority.value} value={priority.value}>
                          <span className={`select-icon-option priority-option priority-option-${priority.value}`}>
                            <PriorityIcon weight="bold" />
                            {priority.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="ticket-property-grid">
                <div className="ticket-property-field">
                  <Label>Total points</Label>
                  <Input
                    type="number"
                    min="1"
                    value={totalPointsInput}
                    onChange={(e) => setTotalPointsInput(e.target.value)}
                    onBlur={() => {
                      const val = totalPointsInput === '' ? null : parseInt(totalPointsInput, 10);
                      if (totalPointsInput !== '' && (isNaN(val) || val < 1)) return;
                      const current = ticket.total_points ?? null;
                      if (val !== current) updateField('total_points', val);
                    }}
                    placeholder="-"
                  />
                </div>
                <div className="ticket-property-field">
                  <Label>Remaining</Label>
                  <Input
                    type="number"
                    min="0"
                    value={pointsRemainingInput}
                    onChange={(e) => setPointsRemainingInput(e.target.value)}
                    onBlur={() => {
                      const val = pointsRemainingInput === '' ? null : parseInt(pointsRemainingInput, 10);
                      if (pointsRemainingInput !== '' && (isNaN(val) || val < 0)) return;
                      const current = ticket.points_remaining ?? null;
                      if (val !== current) updateField('points_remaining', val);
                    }}
                    placeholder="-"
                  />
                </div>
              </div>
              <div className="ticket-property-field">
                <Label>Due date</Label>
                {inSprint ? (
                  <>
                    <Input type="date" value={ticket.due_date || ''} onChange={(e) => updateField('due_date', e.target.value || null)} />
                    <div className="ticket-detail-shortcuts">
                      {sprintEndDate && <Button type="button" size="xs" variant="outline" onClick={() => updateField('due_date', sprintEndDate)}><CalendarBlankIcon weight="bold" />End of sprint</Button>}
                      <Button type="button" size="xs" variant="outline" onClick={() => updateField('due_date', dateFromToday(0))}>Today</Button>
                      <Button type="button" size="xs" variant="outline" onClick={() => updateField('due_date', dateFromToday(1))}>+1</Button>
                      <Button type="button" size="xs" variant="outline" onClick={() => updateField('due_date', dateFromToday(7))}>+7</Button>
                    </div>
                  </>
                ) : (
                  <p className="ticket-property-hint">A due date can be set once this ticket is in a sprint.</p>
                )}
              </div>
            </div>

            <div className="ticket-property-card">
              <div className="ticket-property-header">
                <GitForkIcon weight="bold" />
                Dependencies
              </div>
              <div className="ticket-property-field">
                <Label>Blocked by</Label>
                <ul className="dep-list">
                  {ticket.blockers?.map((blocker) => (
                    <li className="dep-item" key={blocker.id}>
                      <Badge variant={blocker.status === 'done' ? 'secondary' : 'outline'}>{blocker.status === 'done' ? 'done' : 'open'}</Badge>
                      <button type="button" className="label-picker-item" onClick={() => setActiveTicketId(blocker.id)}>
                        #{blocker.number} {blocker.title}
                      </button>
                      <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeDependency(blocker.id)}><XIcon weight="bold" /></Button>
                    </li>
                  ))}
                  {!ticket.blockers?.length && <li className="ticket-detail-muted-row">No blockers.</li>}
                </ul>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowDependencyPicker((value) => !value)}>Add blocker</Button>
                {showDependencyPicker && (
                  <DependencyPicker
                    ticketId={activeTicketId}
                    blockers={ticket.blockers || []}
                    onAdded={() => {
                      setShowDependencyPicker(false);
                      fetchTicket();
                    }}
                  />
                )}
              </div>
              <div className="ticket-property-field">
                <Label>Unblocks</Label>
                <ul className="dep-list">
                  {ticket.unblocks?.map((item) => (
                    <li className="dep-item" key={item.id}>
                      <button type="button" className="label-picker-item" onClick={() => setActiveTicketId(item.id)}>
                        #{item.number} {item.title}
                      </button>
                    </li>
                  ))}
                  {!ticket.unblocks?.length && <li className="ticket-detail-muted-row">No dependent tickets.</li>}
                </ul>
              </div>
            </div>

            {(currentUser?.role === 'admin' || ticket?.creator_id === currentUser?.id) && (
              <Button type="button" variant="destructive" size="sm" onClick={deleteTicket}>
                <TrashIcon weight="bold" />
                Delete ticket
              </Button>
            )}
          </aside>
        </div>
      </DialogContent>
      {pendingStatus && (
        <Dialog open onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
          <DialogContent className="commit-nudge-dialog">
            <DialogHeader>
              <DialogTitle>Link the commit?</DialogTitle>
            </DialogHeader>
            <div className="commit-nudge-copy">
              <p>
                Moving this from In Progress to {STATUSES.find((status) => status.value === pendingStatus)?.label || pendingStatus}
                usually means there is a commit or PR worth linking.
              </p>
              <p className="text-muted">You can skip this for design, planning, ops, or other non-code tickets.</p>
            </div>
            <div className="commit-nudge-actions">
              <Button type="button" className="tickets-new-button" onClick={moveAndOpenCommits}>
                <GitCommitIcon weight="bold" />
                Move and link commit
              </Button>
              <Button type="button" variant="outline" onClick={moveWithoutCommit}>Move without commit</Button>
              <Button type="button" variant="ghost" onClick={() => setPendingStatus(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
