'use client';

import { useRef, useState } from 'react';
import { uploadImageFile } from '@/lib/upload-image';

export default function ImageUploadButton({ onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      onUploaded(await uploadImageFile(file));
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleChange}
      />
      <button
        type="button"
        className="btn btn-sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading...' : 'Upload image'}
      </button>
    </>
  );
}
