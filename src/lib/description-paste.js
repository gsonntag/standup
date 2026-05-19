import { uploadImageFile } from './upload-image';

export function getPastedImage(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const item = items.find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
  return item?.getAsFile() || null;
}

export async function uploadPastedImage(event, onUploaded) {
  const file = getPastedImage(event);
  if (!file) return false;

  event.preventDefault();
  try {
    onUploaded(await uploadImageFile(file));
  } catch (error) {
    alert(error.message);
  }
  return true;
}
