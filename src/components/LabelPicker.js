'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { LABEL_COLORS } from '@/lib/constants';

export default function LabelPicker({ ticketId, currentLabels, onUpdate }) {
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
    await apiFetch(`/api/tickets/${ticketId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId }),
    });
    onUpdate();
  }

  async function removeLabel(labelId) {
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
    await addLabel(data.label.id);
    setNewName('');
    setNewColor(LABEL_COLORS[0].hex);
    fetchAllLabels();
  }

  async function deleteLabel(labelId) {
    if (!confirm('Delete this label from all tickets?')) return;
    await apiFetch(`/api/labels/${labelId}`, { method: 'DELETE' });
    fetchAllLabels();
    onUpdate();
  }

  return (
    <div>
      <div className="label-list">
        {currentLabels.map((label) => (
          <span key={label.id} className="label" style={{ backgroundColor: label.color }}>
            {label.name}
            <button type="button" onClick={() => removeLabel(label.id)}>x</button>
          </span>
        ))}
      </div>
      <button type="button" className="btn btn-sm mt-md" onClick={() => setOpen((value) => !value)}>
        + add label
      </button>
      {open && (
        <div className="label-picker-dropdown">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search labels" />
          <div className="mt-md">
            {filteredLabels.map((label) => {
              const selected = selectedIds.has(label.id);
              return (
                <div key={label.id} className="flex-between">
                  <button
                    type="button"
                    className="label-picker-item"
                    onClick={() => selected ? removeLabel(label.id) : addLabel(label.id)}
                  >
                    <span>{selected ? '[x]' : '[ ]'}</span>
                    <span className="label" style={{ backgroundColor: label.color }}>{label.name}</span>
                  </button>
                  <button type="button" className="dep-remove" onClick={() => deleteLabel(label.id)}>x</button>
                </div>
              );
            })}
          </div>
          <div className="picker-divider">
            <div className="detail-field-label">Create new label</div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
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
            <button type="button" className="btn btn-primary btn-sm" onClick={createLabel}>Create</button>
          </div>
        </div>
      )}
    </div>
  );
}
