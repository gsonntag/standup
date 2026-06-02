'use client';

import { useRef, useState } from 'react';
import { uploadImageFiles } from '@/lib/upload-image';
import { Button } from '@/components/ui/button';

export default function ImageUploadButton({ onUploaded, ticketId = null }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setUploading(true);
    try {
      onUploaded(await uploadImageFiles(files, { ticketId }));
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
        multiple
        onChange={handleChange}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading...' : 'Upload images'}
      </Button>
    </>
  );
}
