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

  const requestPermission = useCallback(async () => {
    // Feature-detect the old “DeviceMotionEvent.requestPermission” API (iOS)
    if (
      window.DeviceMotionEvent &&
      typeof (
        window.DeviceMotionEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const response = await (
          window.DeviceMotionEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (response === "granted") {
          setState((prev) => ({ ...prev, hasPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device motion permission:", err);
        setState((prev) => ({ ...prev, hasPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasPermission: true }));
    }
  }, []);

  useEffect(() => {
    if (state.hasPermission !== true) return;

    // Simulated sensor data for now
    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        x: 0.1,
        y: -0.2,
        z: 9.7,
      }));
    }, 200);

    return () => {
      clearInterval(interval);

      // If real sensor hooks were added, remove them here
      // e.g. window.removeEventListener('devicemotion', handleMotion)
    };
  }, [state.hasPermission]);

  return { state, requestPermission };
}
