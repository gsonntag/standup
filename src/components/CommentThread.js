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

export default function CommentThread({ ticketId, comments, onAdded }) {
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

  return (
    <>
      {comments.map((comment) => (
        <div className="comment" key={comment.id}>
          <div className="comment-header">
            <span className="comment-author">{comment.author_username}</span>
            <span className="comment-date">{timeAgo(comment.created_at)}</span>
          </div>
          <div className="comment-body">{comment.content}</div>
        </div>
      ))}
      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a comment" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? 'Adding...' : 'Add comment'}
        </button>
      </form>
    </>
  );
}
