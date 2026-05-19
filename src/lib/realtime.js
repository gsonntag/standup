'use client';

import { useEffect, useRef } from 'react';

export function useRealtime(onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es;
    let retryTimeout;

    function connect() {
      es = new EventSource('/api/events');
      es.onmessage = (e) => {
        if (e.data === 'ping') return;
        try {
          const event = JSON.parse(e.data);
          onEventRef.current(event);
        } catch (_) {}
      };
      es.onerror = () => {
        es.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, []);
}
