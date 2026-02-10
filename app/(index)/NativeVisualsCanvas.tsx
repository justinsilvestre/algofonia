"use client";
import { useEffect, useRef, useState } from "react";
import { mountVisuals } from "./sketch/nativeVisuals";

export function VisualsCanvas({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const visualsRef = useRef<{
    start: () => void;
    stop: () => void;
    onResize: () => void;
  } | null>(null);

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

  useEffect(() => {
    if (!containerRef.current) return;
    const { start, stop, onResize } = mountVisuals(
      containerRef.current,
      window.innerWidth,
      window.innerHeight
    );

    start();

    window.addEventListener("resize", onResize);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      // Trigger resize on visuals when fullscreen changes
      visualsRef.current?.onResize();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div
      className={`
        overflow-hidden ${className} ${
          isFullscreen
            ? "fixed inset-0 z-50 bg-black w-screen h-screen cursor-none"
            : " bg-gray-900 cursor-pointer w-[600px] h-70 border border-white/40 rounded-lg shadow-lg"
        }
      `}
      onClick={isFullscreen ? undefined : toggleFullscreen}
      onDoubleClick={isFullscreen ? toggleFullscreen : undefined}
    >
      <div
        id="canvasContainer"
        ref={containerRef}
        className={`w-full h-full ${isFullscreen ? "" : "overflow-auto"}`}
      />
    </div>
  );
}
