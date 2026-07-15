'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { timeAgo } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PaperPlaneRightIcon, TrashIcon } from '@phosphor-icons/react';

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/[^)\s]+|\/uploads\/[^)\s]+)\)|@\w+|#\d+)/g;

function renderInline(text, usernames, onTicketRef) {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/uploads\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={i} href={link[2]} target={link[2].startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    if (part.startsWith('@') && usernames.has(part.slice(1))) {
      return <strong key={i}>{part}</strong>;
    }
    if (/^#\d+$/.test(part)) {
      const number = parseInt(part.slice(1), 10);
      return (
        <button key={i} type="button" className="ticket-ref" onClick={() => onTicketRef?.(number)}>
          {part}
        </button>
      );
    }
    return part;
  });
}

function renderCommentContent(content, users, onTicketRef) {
  const usernames = new Set((users || []).map((u) => u.username));
  const lines = content.split('\n');

  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="description-spacer" />;
    if (trimmed.startsWith('### ')) return <h4 key={index}>{renderInline(trimmed.slice(4), usernames, onTicketRef)}</h4>;
    if (trimmed.startsWith('## ')) return <h3 key={index}>{renderInline(trimmed.slice(3), usernames, onTicketRef)}</h3>;
    if (trimmed.startsWith('# ')) return <h2 key={index}>{renderInline(trimmed.slice(2), usernames, onTicketRef)}</h2>;

    const checkbox = trimmed.match(/^- \[([ xX])\] (.*)$/);
    if (checkbox) {
      return (
        <div key={index} className="description-check">
          <input type="checkbox" checked={checkbox[1].toLowerCase() === 'x'} readOnly />
          <span>{renderInline(checkbox[2], usernames, onTicketRef)}</span>
        </div>
      );
    }

    if (trimmed.startsWith('- ')) {
      return <div key={index} className="description-bullet">{renderInline(trimmed.slice(2), usernames, onTicketRef)}</div>;
    }

    return <p key={index}>{renderInline(trimmed, usernames, onTicketRef)}</p>;
  });
}

export default function CommentThread({ ticketId, comments, onAdded, currentUser, onDeleted, users, onTicketRef }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);

  function handleContentChange(e) {
    const val = e.target.value;
    setContent(val);

    // Detect @mention at cursor
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const mentionMatch = textBefore.match(/@(\w{0,32})$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = (users || []).filter((u) => u.username.toLowerCase().startsWith(query));
      setMentionQuery(mentionMatch[1]);
      setMentionUsers(filtered);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionUsers([]);
    }
  }

  function insertMention(username) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const textBefore = content.slice(0, cursor);
    const replaced = textBefore.replace(/@(\w{0,32})$/, `@${username} `);
    const newContent = replaced + content.slice(cursor);
    setContent(newContent);
    setMentionQuery(null);
    setMentionUsers([]);
    // Restore focus
    setTimeout(() => {
      textarea.focus();
      const pos = replaced.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleKeyDown(e) {
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, Math.min(mentionUsers.length, 5) - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        const selected = mentionUsers[mentionIndex] || mentionUsers[0];
        if (selected) {
          e.preventDefault();
          insertMention(selected.username);
          return;
        }
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionUsers([]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    const res = await apiFetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setContent('');
      setMentionQuery(null);
      setMentionUsers([]);
      onAdded(data.comment);
    }
  }

  async function handleDelete(commentId) {
    if (!confirm('Delete this comment?')) return;
    const res = await apiFetch(`/api/tickets/${ticketId}/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok && onDeleted) {
      onDeleted(commentId);
    }
  }

  return (
    <>
      {comments.map((comment) => {
        const isSystem = comment.kind === 'system';
        const isDeleted = !!comment.deleted_at;
        const canDelete = !isSystem && !isDeleted && (
          comment.author_username === currentUser?.username || currentUser?.role === 'admin'
        );

        return (
          <div className={`comment${isSystem ? ' comment-system' : ''}`} key={comment.id}>
            <div className="comment-header">
              <span className="comment-author">{comment.author_username}</span>
              <span className="comment-date">{timeAgo(comment.created_at)}</span>
              {canDelete && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="comment-delete-button"
                  onClick={() => handleDelete(comment.id)}
                  title="Delete comment"
                >
                  <TrashIcon weight="bold" />
                  Delete
                </Button>
              )}
            </div>
            <div className="comment-body">
              {isDeleted ? (
                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                  {comment.content}
                </span>
              ) : (
                renderCommentContent(comment.content, users, onTicketRef)
              )}
              {isDeleted && (
                <span className="text-muted" style={{ marginLeft: '8px', fontSize: 'var(--font-size-sm)' }}>
                  (deleted by {comment.deleted_by_username})
                </span>
              )}
            </div>
          </div>
        );
      })}
      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="comment-composer">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment. Use @username to mention teammates."
            className="comment-textarea"
          />
          {mentionQuery !== null && mentionUsers.length > 0 && (
            <div className="mention-dropdown">
              {mentionUsers.slice(0, 5).map((u, i) => (
                <div
                  key={u.id}
                  className={`mention-option${i === mentionIndex ? ' selected' : ''}`}
                  onClick={() => insertMention(u.username)}
                >
                  @{u.username}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" size="sm" className="tickets-new-button comment-submit-button" disabled={loading || !content.trim()}>
          <PaperPlaneRightIcon weight="bold" />
          {loading ? 'Adding...' : 'Add comment'}
        </Button>
      </form>
    </>
  );
}
