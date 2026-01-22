import { useState, useCallback } from "react";

type MovementState = {
  hasMotionPermission: boolean | null;
  hasOrientationPermission: boolean | null;
};
export function useMovement() {
  const [state, setState] = useState<MovementState>({
    hasMotionPermission: null,
    hasOrientationPermission: null,
  });
  const requestMotionPermission = useCallback(async () => {
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
          setState((prev) => ({ ...prev, hasMotionPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasMotionPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device motion permission:", err);
        setState((prev) => ({ ...prev, hasMotionPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasMotionPermission: true }));
    }
  }, []);

  const requestOrientationPermission = useCallback(async () => {
    // Feature-detect the old “DeviceOrientationEvent.requestPermission” API (iOS)
    if (
      window.DeviceOrientationEvent &&
      typeof (
        window.DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const response = await (
          window.DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (response === "granted") {
          setState((prev) => ({ ...prev, hasOrientationPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasOrientationPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device orientation permission:", err);
        setState((prev) => ({ ...prev, hasOrientationPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasOrientationPermission: true }));
    }
  }, []);

  const requestPermission = useCallback(async () => {
    await requestMotionPermission();
    await requestOrientationPermission();
  }, [requestMotionPermission, requestOrientationPermission]);

  return { requestPermission, state };
}
