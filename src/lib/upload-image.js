import { apiFetch } from './client-api';

export async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await apiFetch('/api/uploads', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload image.');
  }
  return data.markdown;
}
