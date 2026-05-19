'use client';

import { useEffect, useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  function addToast(message, type = 'error') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }
  return { toasts, addToast };
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: t.type === 'error' ? '#dc2626' : '#065f46',
          border: `1px solid ${t.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          maxWidth: '360px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: '0.875rem',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
