export function startBeats(
  bpm: number,
  nextBeatTimestamp: number,
  offsetFromServerTimeRef: React.RefObject<number>,
  callback: () => void
) {
  const beatInterval = (60 / bpm) * 1000; // Convert BPM to milliseconds between beats

  let animationFrameId: number;
  let currentBeatTimestamp = nextBeatTimestamp;

  function animate() {
    // Get current time adjusted with server offset
    const now =
      performance.now() +
      performance.timeOrigin +
      offsetFromServerTimeRef.current;

    // Check if we've reached or passed the current beat timestamp
    if (now >= currentBeatTimestamp) {
      callback();

      // Set next beat timestamp
      currentBeatTimestamp = currentBeatTimestamp + beatInterval;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  animationFrameId = requestAnimationFrame(animate);

  // Return cleanup function
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}
