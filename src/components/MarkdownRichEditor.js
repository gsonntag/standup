'use client';

import React, { useState, useRef, useCallback } from 'react';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Markdown } from '@astryxdesign/core/Markdown';
import {
  TextB as BoldIcon,
  TextItalic as ItalicIcon,
  TextH as HeadingIcon,
  Code as CodeIcon,
  ListBullets as ListIcon,
  CheckSquareOffset as TaskIcon,
  Link as LinkIcon,
  Image as ImageIcon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/client-api';

export default function MarkdownRichEditor({
  value = '',
  onChange,
  placeholder = 'Write a description with markdown and images…',
  ticketId = null,
  minRows = 5,
}) {
  const [mode, setMode] = useState('write');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper to insert markdown formatting at current cursor position
  const insertText = useCallback((before, after = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value || '';
    const selectedText = currentVal.substring(start, end) || defaultText;

    const replacement = `${before}${selectedText}${after}`;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    onChange?.(nextVal);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [onChange]);

  // Upload an image file to /api/uploads and insert its markdown
  const handleUploadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, GIF, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be 5MB or smaller.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (ticketId) formData.append('ticket_id', ticketId);

      const res = await apiFetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error || 'Failed to upload image.');
        return;
      }

      const data = await res.json();
      const md = data.markdown || (data.url ? `![${file.name || 'image'}](${data.url})` : '');

      if (md) {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const currentVal = textarea.value || '';
          const nextVal = `${currentVal.substring(0, start)}\n\n${md}\n\n${currentVal.substring(end)}`;
          onChange?.(nextVal);
        } else {
          onChange?.(`${value ? `${value}\n\n` : ''}${md}\n`);
        }
      }
    } catch {
      setUploadError('Network error uploading image.');
    } finally {
      setIsUploading(false);
    }
  }, [ticketId, onChange, value]);

  // Handle paste for screenshots
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleUploadFile(file);
          return;
        }
      }
    }
  }, [handleUploadFile]);

  // Handle drop for drag & drop images
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type && file.type.startsWith('image/')) {
        handleUploadFile(file);
      }
    }
  }, [handleUploadFile]);

  return (
    <Card p={0} variant="subtle" style={{ overflow: 'hidden' }}>
      {/* Top Bar: Mode switcher and Formatting Toolbar */}
      <HStack
        gap={2}
        vAlign="center"
        justify="space-between"
        p={2}
        wrap="wrap"
        style={{
          borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
          backgroundColor: 'var(--color-surface, var(--color-background))',
        }}
      >
        <TabList value={mode} onChange={setMode} size="sm">
          <Tab value="write" label="Write" />
          <Tab value="preview" label="Preview" />
        </TabList>

        {mode === 'write' && (
          <HStack gap={1} vAlign="center" wrap="wrap">
            <Button
              variant="ghost"
              size="sm"
              icon={<BoldIcon size={14} weight="bold" />}
              isIconOnly
              label="Bold (Cmd+B)"
              onClick={() => insertText('**', '**', 'bold text')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<ItalicIcon size={14} weight="bold" />}
              isIconOnly
              label="Italic (Cmd+I)"
              onClick={() => insertText('*', '*', 'italic text')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<HeadingIcon size={14} weight="bold" />}
              isIconOnly
              label="Heading"
              onClick={() => insertText('### ', '\n', 'Heading')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<CodeIcon size={14} weight="bold" />}
              isIconOnly
              label="Code block"
              onClick={() => insertText('```\n', '\n```\n', 'code')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<ListIcon size={14} weight="bold" />}
              isIconOnly
              label="Bullet list"
              onClick={() => insertText('- ', '\n', 'List item')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<TaskIcon size={14} weight="bold" />}
              isIconOnly
              label="Task checklist"
              onClick={() => insertText('- [ ] ', '\n', 'Task item')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<LinkIcon size={14} weight="bold" />}
              isIconOnly
              label="Insert link"
              onClick={() => insertText('[', '](https://)', 'link title')}
            />

            {/* Hidden file picker input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />

            <Button
              variant="secondary"
              size="sm"
              icon={<ImageIcon size={14} weight="bold" />}
              label={isUploading ? 'Uploading…' : '+ Image'}
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
            />
          </HStack>
        )}
      </HStack>

      {/* Upload error banner if any */}
      {uploadError && (
        <HStack p={2} justify="space-between" vAlign="center" style={{ backgroundColor: 'var(--color-status-error-subtle, rgba(239,68,68,0.1))' }}>
          <Text size="xs" color="error">{uploadError}</Text>
          <Button variant="ghost" size="sm" label="Dismiss" onClick={() => setUploadError(null)} />
        </HStack>
      )}

      {/* Editor Content Area */}
      {mode === 'write' ? (
        <VStack gap={0} p={3}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            placeholder={placeholder}
            rows={minRows}
            style={{
              width: '100%',
              minHeight: 140,
              resize: 'vertical',
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: 'inherit',
              backgroundColor: 'transparent',
            }}
          />
          <HStack gap={2} vAlign="center" justify="space-between" pt={2} style={{ borderTop: '1px solid var(--color-border-subtle, rgba(0,0,0,0.05))' }}>
            <Text size="xs" color="secondary">
              Markdown, images & screenshots supported. Paste or drop images directly.
            </Text>
            {isUploading && (
              <Badge variant="accent">Uploading image…</Badge>
            )}
          </HStack>
        </VStack>
      ) : (
        /* Live Markdown Preview */
        <div style={{ padding: '16px', minHeight: 140, overflowY: 'auto', maxHeight: 420 }}>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <Text size="sm" color="secondary" style={{ fontStyle: 'italic' }}>
              Nothing to preview yet. Switch to Write to add description content.
            </Text>
          )}
        </div>
      )}
    </Card>
  );
}
