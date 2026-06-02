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
  if (!res.ok) {
    let errMsg = 'Failed to upload images.';
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {
      // Fallback for HTML error pages or non-JSON payloads
    }
    throw new Error(errMsg);
  }
  const data = await res.json();
  return data.markdown;
}

export async function uploadImageFile(file, options) {
  return uploadImageFiles([file], options);
}
