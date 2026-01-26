"use client";
import { RefObject, useEffect, useRef, useState } from "react";
import type p5 from "p5";

type P5Class = typeof p5;

export function useP5() {
  const [p5, setP5] = useState<P5Class | null>(null);

  useEffect(() => {
    if (p5) return;

    import("p5").then((module) => {
      setP5(() => module.default);
    });
  }, [p5]);

  return p5;
}

export function VisualsCanvas({
  P5Class,
  loadSketch,
  className = "",
}: {
  P5Class: P5Class;
  loadSketch: (p: p5, parent: RefObject<string | object | p5.Element>) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
    if (p5InstanceRef.current) return;

    p5InstanceRef.current = new P5Class((p) => {
      if (!containerRef.current) throw new Error("Container ref is null");
      loadSketch(p, containerRef as RefObject<string | object | p5.Element>);
    });

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, [P5Class, loadSketch]);

  useEffect(() => {
    const handleResize = () => {
      if (p5InstanceRef.current && isFullscreen) {
        p5InstanceRef.current.resizeCanvas(
          p5InstanceRef.current.windowWidth,
          p5InstanceRef.current.windowHeight
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isFullscreen]);

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
