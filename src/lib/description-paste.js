import { uploadImageFiles } from './upload-image';

export function getPastedImages(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((entry) => entry.kind === 'file' && entry.type.startsWith('image/'))
    .map((entry) => entry.getAsFile())
    .filter(Boolean);
}

export async function uploadPastedImage(event, onUploaded, options) {
  const files = getPastedImages(event);
  if (!files.length) return false;

  event.preventDefault();
  try {
    onUploaded(await uploadImageFiles(files, options));
  } catch (error) {
    alert(error.message);
  }
  return true;
}
