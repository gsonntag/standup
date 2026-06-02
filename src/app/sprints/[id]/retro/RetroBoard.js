'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftIcon, ChatCircleTextIcon, PlusIcon, SmileyIcon, TrashIcon, TrendUpIcon } from '@phosphor-icons/react';
import AppPageHeader from '@/components/AppPageHeader';

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
    const Icon = category === 'went_well' ? SmileyIcon : TrendUpIcon;
    return (
      <Card className="retro-column">
        <CardHeader className="retro-column-header">
          <div className="retro-column-title">
            <span className="retro-column-icon"><Icon weight="bold" /></span>
            <CardTitle>{title}</CardTitle>
          </div>
          <span className="retro-count">{colNotes.length}</span>
        </CardHeader>
        <CardContent>
          <div className="retro-notes">
            {colNotes.map((note) => (
              <div key={note.id} className="retro-note">
                <div className="retro-note-content">{note.content}</div>
                {(myNoteIds.has(note.id) || currentUser.role === 'admin') && (
                  <Button type="button" size="icon-xs" variant="ghost" className="retro-note-delete" onClick={() => deleteNote(note.id)}>
                    <TrashIcon weight="bold" />
                    <span className="sr-only">Delete note</span>
                  </Button>
                )}
              </div>
            ))}
            {colNotes.length === 0 && (
              <div className="retro-empty">
                <ChatCircleTextIcon weight="bold" />
                <span>No notes yet.</span>
              </div>
            )}
          </div>
          <div className="retro-add">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add a note..."
              rows={3}
            />
            <Button type="button" size="sm" className="tickets-new-button" onClick={() => handleAdd(category, value, setValue)}>
              <PlusIcon weight="bold" />
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="page">
      <div className="retro-back-row">
        <Button asChild type="button" size="sm" variant="outline">
          <a href="/sprints"><ArrowLeftIcon weight="bold" />Back to sprints</a>
        </Button>
      </div>
      <AppPageHeader
        icon={ChatCircleTextIcon}
        eyebrow="Retro"
        title="Sprint Retrospective"
        subtitle="Capture what worked, what needs attention, and what the team should adjust next."
      />
      <div className="retro-board">
        {renderColumn('Went Well', 'went_well', wentWell, setWentWell)}
        {renderColumn('To Improve', 'improve', improve, setImprove)}
      </div>
    </div>
  );
}
