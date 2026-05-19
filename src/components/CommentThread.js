'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommentThread({ ticketId, comments, onAdded, currentUser, onDeleted }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

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
                <button
                  type="button"
                  className="dep-remove"
                  onClick={() => handleDelete(comment.id)}
                  title="Delete comment"
                >
                  delete
                </button>
              )}
            </div>
            <div className="comment-body">
              {isDeleted ? (
                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                  {comment.content}
                </span>
              ) : (
                comment.content
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
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a comment" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? 'Adding...' : 'Add comment'}
        </button>
      </form>
    </>
  );
}
