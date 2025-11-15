"use client";
import { useState } from "react";

export function useWebsocketUrl() {
  const [url] = useState<null | string>(() =>
    typeof window !== "undefined" ? `wss://${window.location.host}` : null
  );
  return url;
}
