'use client';
const DEFAULT_ROOM_NAME = 'default';
export function getRoomName() {
  if (typeof window === 'undefined') return DEFAULT_ROOM_NAME;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') || DEFAULT_ROOM_NAME;
}
