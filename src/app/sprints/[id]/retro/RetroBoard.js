'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

export default function RetroBoard({ sprintId, currentUser }) {
  const [notes, setNotes] = useState([]);
  const [wentWell, setWentWell] = useState('');
  const [improve, setImprove] = useState('');
  const [myNoteIds, setMyNoteIds] = useState(new Set());

  async function fetchNotes() {
    const res = await apiFetch(`/api/sprints/${sprintId}/retro`);
    const data = await res.json();
    setNotes(data.notes || []);
  }

  useEffect(() => { fetchNotes(); }, [sprintId]);

  async function handleAdd(category, content, clearFn) {
    if (!content.trim()) return;
    const res = await apiFetch(`/api/sprints/${sprintId}/retro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content }),
    });
    if (res.ok) {
      const data = await res.json();
      clearFn('');
      setMyNoteIds((prev) => new Set([...prev, data.note.id]));
      fetchNotes();
    }
  }

  async function deleteNote(noteId) {
    await apiFetch(`/api/sprints/${sprintId}/retro/${noteId}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  function renderColumn(title, category, value, setValue) {
    const colNotes = notes.filter((n) => n.category === category);
    return (
      <div className="retro-column">
        <h3>{title}</h3>
        <div className="retro-notes">
          {colNotes.map((note) => (
            <div key={note.id} className="retro-note">
              <div className="retro-note-content">{note.content}</div>
              {(myNoteIds.has(note.id) || currentUser.role === 'admin') && (
                <button type="button" className="dep-remove" onClick={() => deleteNote(note.id)}>×</button>
              )}
            </div>
          ))}
          {colNotes.length === 0 && <div className="empty">No notes yet.</div>}
        </div>
        <div className="retro-add">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a note..."
            rows={2}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={() => handleAdd(category, value, setValue)}>
            Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sprint Retrospective</h1>
        <a href="/sprints" className="btn btn-sm">← Back to Sprints</a>
      </div>
      <div className="retro-board">
        {renderColumn('Went Well', 'went_well', wentWell, setWentWell)}
        {renderColumn('To Improve', 'improve', improve, setImprove)}
      </div>
    </div>
  );
}
