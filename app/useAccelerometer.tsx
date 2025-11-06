"use client";
import { useState, useCallback, useEffect } from "react";

type AccelerometerState = {
  x: number;
  y: number;
  z: number;
  hasPermission: boolean | null; // null = not asked yet
  supported: boolean;
};

export function useAccelerometer() {
  const [state, setState] = useState<AccelerometerState>({
    x: 0,
    y: 0,
    z: 0,
    hasPermission: null,
    supported: true, // pretend supported for now
  });

  // Dummy permission request – imitates async browser permission flow
  const requestPermission = useCallback(async () => {
    // simulate delay
    await new Promise((r) => setTimeout(r, 300));

    setState((prev) => ({
      ...prev,
      hasPermission: true,
    }));
  }, []);

  // Simulate sensor data updating
  useEffect(() => {
    // Only run dummy updates once permission is granted
    if (state.hasPermission !== true) return;

    const interval = setInterval(() => {
      // Produce static-ish fake values with slight jitter
      setState((prev) => ({
        ...prev,
        x: 0.1,
        y: -0.2,
        z: 9.7, // ~gravity on Earth
      }));
    }, 200);

    return () => clearInterval(interval);
  }, [state.hasPermission]);

  return { state, requestPermission };
}
