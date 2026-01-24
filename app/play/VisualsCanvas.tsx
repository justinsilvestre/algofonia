"use client";
import { useEffect, useRef, useState } from "react";
import { draw, setup } from "./sketch";
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
  className = "",
}: {
  P5Class: P5Class;
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

    p5InstanceRef.current = new P5Class((p) => {
      p.setup = () => setup(p, "canvasContainer");
      p.draw = () => draw(p);
    });

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, [P5Class, isFullscreen]);

  useEffect(() => {
    if (p5InstanceRef.current) {
      if (isFullscreen) {
        p5InstanceRef.current.resizeCanvas(
          p5InstanceRef.current.windowWidth,
          p5InstanceRef.current.windowHeight
        );
      } else {
        p5InstanceRef.current.resizeCanvas(400, 300);
      }
    }
  }, [isFullscreen]);

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
            : " bg-gray-900 cursor-pointer w-[600px] h-[450px] border border-white/40 rounded-lg shadow-lg"
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
