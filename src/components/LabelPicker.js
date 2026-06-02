'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { LABEL_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TagIcon, TrashIcon, XIcon } from '@phosphor-icons/react';

export default function LabelPicker({ ticketId, currentLabels = [], onUpdate, onChange }) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0].hex);

  async function fetchAllLabels() {
    const res = await apiFetch('/api/labels');
    const data = await res.json();
    setLabels(data.labels || []);
  }

  useEffect(() => {
    if (open) fetchAllLabels();
  }, [open]);

  const selectedIds = new Set(currentLabels.map((label) => label.id));
  const filteredLabels = useMemo(() => {
    const q = search.toLowerCase();
    return labels.filter((label) => label.name.toLowerCase().includes(q));
  }, [labels, search]);

  async function addLabel(labelId) {
    const label = labels.find((item) => item.id === labelId);
    if (!ticketId) {
      if (label && !selectedIds.has(label.id)) onChange?.([...currentLabels, label]);
      return;
    }
    await apiFetch(`/api/tickets/${ticketId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    onUpdate();
  }

  async function removeLabel(labelId) {
    if (!ticketId) {
      onChange?.(currentLabels.filter((label) => label.id !== labelId));
      return;
    }
    await apiFetch(`/api/tickets/${ticketId}/labels`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    onUpdate();
  }

  async function createLabel() {
    if (!newName.trim()) return;
    const res = await apiFetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to create label');
      return;
    }
    setLabels((prev) => {
      const next = prev.filter((label) => label.id !== data.label.id);
      return [...next, data.label].sort((a, b) => a.name.localeCompare(b.name));
    });
    if (!ticketId) {
      if (!selectedIds.has(data.label.id)) onChange?.([...currentLabels, data.label]);
    } else {
      await addLabel(data.label.id);
    }
    setNewName('');
    setNewColor(LABEL_COLORS[0].hex);
    if (ticketId) fetchAllLabels();
  }

  async function deleteLabel(labelId) {
    if (!confirm('Delete this label from all tickets?')) return;
    await apiFetch(`/api/labels/${labelId}`, { method: 'DELETE' });
    fetchAllLabels();
    onChange?.(currentLabels.filter((label) => label.id !== labelId));
    onUpdate?.();
  }

  return (
    <div className="label-picker">
      <div className="label-list">
        {currentLabels.map((label) => (
          <Badge key={label.id} className="label" style={{ '--label-color': label.color }} variant="outline">
            {label.name}
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeLabel(label.id)} aria-label={`Remove ${label.name}`}>
              <XIcon weight="bold" />
            </Button>
          </Badge>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" className="label-picker-trigger" onClick={() => setOpen((value) => !value)}>
        <TagIcon weight="bold" />
        {open ? 'Close labels' : 'Add label'}
      </Button>
      {open && (
        <div className="label-picker-dropdown">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search labels" />
          <div className="label-picker-options">
            {filteredLabels.map((label) => {
              const selected = selectedIds.has(label.id);
              return (
                <div key={label.id} className="label-picker-row">
                  <button
                    type="button"
                    className="label-picker-item"
                    onClick={() => selected ? removeLabel(label.id) : addLabel(label.id)}
                  >
                    <Checkbox checked={selected} aria-hidden="true" tabIndex={-1} />
                    <Badge className="label" style={{ '--label-color': label.color }} variant="outline">{label.name}</Badge>
                  </button>
                  <Button type="button" size="icon-xs" variant="ghost" className="dep-remove" onClick={() => deleteLabel(label.id)} aria-label={`Delete ${label.name}`}>
                    <TrashIcon weight="bold" />
                  </Button>
                </div>
              );
            })}
            {!filteredLabels.length && <div className="ticket-detail-empty">No matching labels.</div>}
          </div>
          <div className="picker-divider">
            <div className="detail-field-label">Create new label</div>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
            <div className="color-grid">
              {LABEL_COLORS.map((color) => (
                <button
                  type="button"
                  key={color.hex}
                  title={color.name}
                  className={`color-swatch ${newColor === color.hex ? 'selected' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setNewColor(color.hex)}
                />
              ))}
            </div>
            <Button type="button" size="sm" className="tickets-new-button" onClick={createLabel}>Create label</Button>
          </div>
        </div>
      )}
    </div>
  );
}
