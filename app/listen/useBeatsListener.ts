import { useEffect } from "react";

export function useBeatsListener(
  beatsStartTimestamp: number | null,
  getBpm: () => number,
  beatsCountRef: React.RefObject<number>,
  nextBeatTimestampRef: React.RefObject<number | null>,
  offsetFromServerTimeRef: React.RefObject<number>,
  callback: (nextBeatTimestamp: number) => void
) {
  useEffect(() => {
    if (beatsStartTimestamp == null) return;
    let animationFrameId: number;
    let currentBeatTimestamp = beatsStartTimestamp;

    function animate() {
      // Get current time adjusted with server offset
      const now =
        performance.now() +
        performance.timeOrigin +
        offsetFromServerTimeRef.current;

      const currentBpm = getBpm();
      const beatInterval = (60 / currentBpm) * 1000;

      // Check if we've reached or passed the current beat timestamp
      if (
        now >= currentBeatTimestamp ||
        now >= (nextBeatTimestampRef.current ?? 0)
      ) {
        const nextBeatTimestamp = currentBeatTimestamp + beatInterval;
        nextBeatTimestampRef.current = nextBeatTimestamp;
        beatsCountRef.current += 1;

        callback(nextBeatTimestamp);

        // Set next beat timestamp
        currentBeatTimestamp = nextBeatTimestamp;
      }

      animationFrameId = requestAnimationFrame(animate);
    }
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    beatsStartTimestamp,
    getBpm,
    offsetFromServerTimeRef,
    callback,
    nextBeatTimestampRef,
    beatsCountRef,
  ]);
}
