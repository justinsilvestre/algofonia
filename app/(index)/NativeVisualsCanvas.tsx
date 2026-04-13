"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { VisualsInterface } from "./sketch/VisualsInterface";
import { ToneControls } from "./tone";

export function useVisuals<VisualsStateType>({
  initialize,
  toneControls,
  beforeStart,
}: {
  initialize: (
    container: HTMLElement,
    width: number,
    height: number,
    toneControls: ToneControls
  ) => VisualsInterface<VisualsStateType>;
  toneControls: ToneControls;
  beforeStart?: () => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [started, setStarted] = useState(false);

  const [controls, setControls] =
    useState<VisualsInterface<VisualsStateType> | null>(null);

  // Toggle fullscreen using browser API
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  };

  const start = useCallback(() => {
    if (!containerRef.current) return;
    const visuals = initialize(
      containerRef.current,
      window.innerWidth,
      window.innerHeight,
      toneControls
    );
    setControls(visuals);
    visuals.start();
  }, [initialize, toneControls]);

  // Handle window resize
  useEffect(() => {
    if (controls) window.addEventListener("resize", controls.onResize);

    return () => {
      if (controls) window.removeEventListener("resize", controls.onResize);
    };
  }, [controls]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      // Trigger resize on visuals when fullscreen changes
      controls?.onResize();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [controls]);

  return {
    instance: controls,
    started,
    containerRef,
    isFullscreen,
    toggleFullscreen,
    start: () => {
      if (!started) {
        console.log("Starting visuals...");
        if (!beforeStart) {
          start();
          setStarted(true);
        } else
          beforeStart().then(() => {
            start();
            setStarted(true);
          });
      }
    },
  };
}

export function VisualsCanvas({
  className = "",
  visuals,
}: {
  className?: string;
  visuals: ReturnType<typeof useVisuals>;
}) {
  const { start, started, isFullscreen, toggleFullscreen, containerRef } =
    visuals;

  return (
    <div
      className={`
        overflow-hidden ${className} ${
          isFullscreen
            ? "fixed inset-0 z-50 bg-black w-screen h-screen cursor-none "
            : started
              ? " bg-gray-900 cursor-pointer w-[600px] h-70 border border-white/40 rounded-lg shadow-lg"
              : " w-96 h-72  bg-gray-900 cursor-pointer border border-white/40 rounded-lg shadow-lg"
        }
      `}
      onClick={isFullscreen || !started ? undefined : toggleFullscreen}
      onDoubleClick={isFullscreen || !started ? toggleFullscreen : undefined}
    >
      {
        <div
          id="canvasContainer"
          ref={containerRef}
          className={`w-full h-full ${isFullscreen ? "" : "overflow-auto"} ${
            started ? "" : "opacity-0 absolute -z-1"
          }`}
        />
      }
      {!started && (
        <button
          className="w-96 h-72 rounded-lg cursor-pointer flex items-center justify-center text-lg"
          onClick={start}
        >
          Start Visuals
        </button>
      )}
    </div>
  );
}
