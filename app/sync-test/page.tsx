"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useWebsocketUrl } from "./control/useWebsocketUrl";
import { WebSocketMessage, MessageTypes } from "@/server/MessageTypes";

export default function SyncTestPage() {
  const [currentBpm, setCurrentBpm] = useState(120);
  const [beatCount, setBeatCount] = useState(0);
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);

  // Track scheduled beat timeouts and animation frames
  const scheduledBeatTimeout = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const targetBeatTimestamp = useRef<number | null>(null);

  // Function to flash background by directly manipulating DOM styles
  const flashBackground = () => {
    const container = document.getElementById("sync-page-container");
    if (container) {
      // Set flash background
      container.style.background = "white";

      // Reset after 100ms
      setTimeout(() => {
        container.style.background = "";
      }, 100);
    }
  };

  // Function to schedule a beat flash at a specific timestamp with high precision
  const scheduleBeatFlash = useCallback((nextBeatTimestamp: number) => {
    // Clear any existing scheduled beat
    if (scheduledBeatTimeout.current) {
      clearTimeout(scheduledBeatTimeout.current);
      scheduledBeatTimeout.current = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    const now = performance.now() + performance.timeOrigin;
    const delay = nextBeatTimestamp - now;

    // Only schedule if the beat is in the future
    if (delay > 0) {
      targetBeatTimestamp.current = nextBeatTimestamp;

      // High-precision timing function using requestAnimationFrame
      const checkBeatTiming = () => {
        if (targetBeatTimestamp.current === null) return;

        const now = performance.now() + performance.timeOrigin;
        const timeUntilBeat = targetBeatTimestamp.current - now;

        // If we're within 16ms (one frame at 60fps) of the target time, execute the beat
        if (timeUntilBeat <= 16) {
          flashBackground();
          setBeatCount((prev) => prev + 1);
          targetBeatTimestamp.current = null;

          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
          }
        } else {
          // Continue checking on the next frame
          animationFrameId.current = requestAnimationFrame(checkBeatTiming);
        }
      };

      // If we're more than 100ms away, use setTimeout to get close, then switch to rAF
      if (delay > 100) {
        scheduledBeatTimeout.current = setTimeout(() => {
          // Switch to high-precision timing when we're close
          animationFrameId.current = requestAnimationFrame(checkBeatTiming);
        }, delay - 50); // Start precise timing 50ms early
      } else {
        // We're close enough, start precise timing immediately
        animationFrameId.current = requestAnimationFrame(checkBeatTiming);
      }
    }
  }, []);

  const {
    isConnected,
    isConnecting,
    userCount,
    userId,
    error,
    joinRoom,
    leaveRoom,
    onMessage,
    offMessage,
  } = useWebSocket({
    url: useWebsocketUrl(),
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });
  const isInRoom = userId != null;

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      const timestamp = new Date().toLocaleTimeString();

      if (message.type === MessageTypes.BEAT) {
        // Schedule next beat flash based on nextBeatTimestamp
        const { bpm, nextBeatTimestamp } = message;
        scheduleBeatFlash(nextBeatTimestamp);

        setCurrentBpm(bpm);
        setReceivedMessages((prev) => [
          ...prev.slice(-9), // Keep last 10 messages
          `${timestamp} - BEAT (BPM: ${bpm}) - Next: ${new Date(
            nextBeatTimestamp
          ).toLocaleTimeString()}`,
        ]);
      } else if (message.type === MessageTypes.SET_TEMPO) {
        // Schedule next beat flash based on new tempo
        const { bpm, nextBeatTimestamp } = message;
        setCurrentBpm(bpm || 120);
        scheduleBeatFlash(nextBeatTimestamp);

        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - TEMPO SET to ${bpm} BPM - Next: ${new Date(
            nextBeatTimestamp
          ).toLocaleTimeString()}`,
        ]);
      } else if (message.type === MessageTypes.JOIN_ROOM_REQUEST) {
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - Joined room successfully`,
        ]);
      } else if (message.type === MessageTypes.ERROR) {
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - ERROR: ${message.message}`,
        ]);
      } else if (message.type === MessageTypes.USER_COUNT) {
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - User count updated: ${message.count}`,
        ]);
      } else if (message.type === MessageTypes.ASSIGN_USER_ID) {
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - Joined room successfully`,
        ]);
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage, scheduleBeatFlash]);

  // Cleanup scheduled timeouts and animation frames on unmount
  useEffect(() => {
    return () => {
      if (scheduledBeatTimeout.current) {
        clearTimeout(scheduledBeatTimeout.current);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  const handleJoinRoom = () => {
    if (isConnected) {
      joinRoom();
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setReceivedMessages((prev) => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()} - Left room`,
    ]);
  };

  const connectionStatus = isConnecting
    ? "Connecting..."
    : isConnected
    ? "Connected"
    : "Disconnected";

  return (
    <div
      id="sync-page-container"
      className="min-h-screen p-4 transition-all duration-100 bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900"
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Beat Listener
        </h1>

        {/* Connection Status */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">
            Connection Status
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-300">Status: </span>
              <span
                className={`font-mono ${
                  isConnected ? "text-green-400" : "text-red-400"
                }`}
              >
                {connectionStatus}
              </span>
            </div>
          </div>
          {error && <div className="mt-2 text-red-400 text-sm">{error}</div>}
        </div>

        {/* Room Controls */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">
            Room Controls
          </h2>
          <div className="space-y-3">
            {userId && (
              <div className="text-sm text-gray-300">
                <div>
                  Your User ID:{" "}
                  <span className="font-mono text-white">{userId}</span>
                </div>
                <div>
                  <span className="text-gray-300">Users in room: </span>
                  <span className="font-mono text-white">{userCount}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              {!isInRoom ? (
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white rounded transition-colors"
                >
                  Join Main Room
                </button>
              ) : (
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                >
                  Leave Room
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Beat Listener */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">
            Beat Listener
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-300">Current BPM: </span>
                <span className="font-mono text-white">{currentBpm}</span>
              </div>
              <div>
                <span className="text-gray-300">Beats received: </span>
                <span className="font-mono text-white">{beatCount}</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              Listening for beats from controller... Background flashes are
              scheduled based on precise timing.
            </div>
          </div>
        </div>

        {/* Message Log */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">Message Log</h2>
          <div className="space-y-1 text-sm font-mono text-gray-300 max-h-40 overflow-y-auto">
            {receivedMessages.length === 0 ? (
              <div className="text-gray-500">No messages yet...</div>
            ) : (
              receivedMessages.map((message, index) => (
                <div key={index} className="wrap-break-word">
                  {message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
