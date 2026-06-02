import { apiFetch } from './client-api';

export async function uploadImageFiles(files, { ticketId = null } = {}) {
  const imageFiles = Array.from(files || []).filter(Boolean);
  if (!imageFiles.length) return '';

  const formData = new FormData();
  for (const file of imageFiles) {
    formData.append('image', file);
  }
  if (ticketId) formData.append('ticket_id', ticketId);

  const res = await apiFetch('/api/uploads', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload images.');
  }
  return data.markdown;
}

export async function uploadImageFile(file, options) {
  return uploadImageFiles([file], options);
}
