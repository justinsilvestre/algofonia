"use client";
import { useRef, useCallback } from "react";

export function useServerTimeSync() {
  const offsetFromServerTimeRef = useRef<number>(0);
  const syncSamples = useRef<
    Array<{
      t0: number;
      s0: number;
      t1: number;
    }>
  >([]);
  const syncRequestsCountRef = useRef<number>(0);

  const processSyncReply = useCallback(
    ({ t0, s0, t1 }: { t0: number; s0: number; t1: number }) => {
      syncSamples.current.push({ t0, s0, t1 });

      // choose the sample with the minimum round-trip time
      let bestSample = syncSamples.current[0];
      let minRtt = bestSample.t1 - bestSample.t0;

      for (const sample of syncSamples.current) {
        const rtt = sample.t1 - sample.t0;
        if (rtt < minRtt) {
          minRtt = rtt;
          bestSample = sample;
        }
      }

      // calculate offset using the best sample
      const offset = bestSample.s0 - (bestSample.t0 + bestSample.t1) / 2;
      offsetFromServerTimeRef.current = offset;
    },
    []
  );

  return { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef };
}
