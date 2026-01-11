'use client';
import { useState } from 'react';

export function useWebsocketUrl() {
  const [url] = useState<null | string>(() => {
    if (typeof window === 'undefined') return null;
    const pageIsSecure = window.location.protocol === 'https:';
    if (pageIsSecure) {
      return `wss://${window.location.host}/ws`;
    }
    return `ws://${window.location.host}/ws`;
  });
  return url;
}
