'use client';

import { useEffect, useRef } from 'react';

// Shared EventSource connection singleton
let sharedEventSource = null;
const listeners = new Set();
let retryTimeout = null;

function getSharedEventSource() {
  if (sharedEventSource) return sharedEventSource;

  function connect() {
    sharedEventSource = new EventSource('/api/events');
    sharedEventSource.onmessage = (e) => {
      if (e.data === 'ping') return;
      try {
        const event = JSON.parse(e.data);
        listeners.forEach((listener) => listener(event));
      } catch (_) {}
    };
    sharedEventSource.onerror = () => {
      if (sharedEventSource) {
        sharedEventSource.close();
        sharedEventSource = null;
      }
      retryTimeout = setTimeout(connect, 5000);
    };
  }

  connect();
  return sharedEventSource;
}

export function useRealtime(onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const listener = (event) => {
      onEventRef.current(event);
    };

    listeners.add(listener);
    getSharedEventSource();

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        if (sharedEventSource) {
          sharedEventSource.close();
          sharedEventSource = null;
        }
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
      }
    };
  }, []);
}

