"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useWebsocketUrl } from "./control/useWebsocketUrl";
import { WebSocketMessage, MessageTypes } from "@/server/MessageTypes";

export default function SyncTestPage() {
  const [currentBpm, setCurrentBpm] = useState(120);
  const [beatCount, setBeatCount] = useState(0);
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [offsetFromServerTime, setOffsetFromServerTime] = useState<
    number | null
  >(null);
  const [roundTripTime, setRoundTripTime] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Track scheduled beat timeouts and animation frames
  const scheduledBeatTimeout = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const targetBeatTimestamp = useRef<number | null>(null);

  // Track pending sync requests and sync samples
  const pendingSyncRequests = useRef<Map<number, number>>(new Map());
  const syncSamples = useRef<
    Array<{
      t1: number;
      t2: number;
      t3: number;
      t4: number;
      offset: number;
      roundTripTime: number;
    }>
  >([]);

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
    sendMessage,
    onMessage,
    offMessage,
  } = useWebSocket({
    url: useWebsocketUrl(),
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  // Function to perform comprehensive time synchronization with server
  const performTimeSync = useCallback(async () => {
    if (!isConnected) return;

    // Reset sync samples and show progress
    syncSamples.current = [];
    setSyncProgress({ current: 0, total: 30 });

    // Send 30 sync requests with small delays between them
    for (let i = 0; i < 30; i++) {
      const t1 = performance.now() + performance.timeOrigin;
      pendingSyncRequests.current.set(t1, t1);

      sendMessage({
        type: MessageTypes.SYNC,
        t1: t1,
      });

      setSyncProgress({ current: i + 1, total: 30 });

      // Small delay between requests to avoid overwhelming the server
      if (i < 29) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }, [isConnected, sendMessage]);

  // Function to process a single sync reply and determine best offset when all samples are collected
  const calculateTimeOffset = useCallback(
    (t1: number, t2: number, t3: number) => {
      const t4 = performance.now() + performance.timeOrigin; // Client timestamp when reply was received

      // Calculate offset: ((t₂ − t₁) + (t₃ − t₄)) / 2
      const offset = (t2 - t1 + (t3 - t4)) / 2;

      // Calculate round-trip time: (t₄ − t₁) − (t₃ − t₂)
      const roundTripTime = t4 - t1 - (t3 - t2);

      // Store this sample
      syncSamples.current.push({
        t1,
        t2,
        t3,
        t4,
        offset,
        roundTripTime,
      });

      pendingSyncRequests.current.delete(t1);

      // If we have all 30 samples, choose the best one
      if (syncSamples.current.length === 30) {
        // Sort by round-trip time (ascending) and pick the one with lowest RTT
        const sortedSamples = [...syncSamples.current].sort(
          (a, b) => a.roundTripTime - b.roundTripTime
        );
        const bestSample = sortedSamples[0];

        setOffsetFromServerTime(bestSample.offset);
        setRoundTripTime(bestSample.roundTripTime);
        setSyncProgress(null);

        console.log(`Time sync completed with 30 samples:`);
        console.log(
          `Best offset: ${bestSample.offset.toFixed(
            3
          )}ms (RTT: ${bestSample.roundTripTime.toFixed(3)}ms)`
        );
        console.log(
          `Average RTT: ${(
            syncSamples.current.reduce((sum, s) => sum + s.roundTripTime, 0) /
            30
          ).toFixed(3)}ms`
        );
        console.log(
          `RTT range: ${sortedSamples[0].roundTripTime.toFixed(
            3
          )}ms - ${sortedSamples[29].roundTripTime.toFixed(3)}ms`
        );
      }
    },
    []
  );

  const isInRoom = userId != null;

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      const timestamp = new Date().toLocaleTimeString();

      if (message.type === MessageTypes.SYNC_REPLY) {
        // Handle time synchronization reply
        const { t1, t2, t3 } = message;
        if (pendingSyncRequests.current.has(t1)) {
          calculateTimeOffset(t1, t2, t3);
        }
      } else if (message.type === MessageTypes.BEAT) {
        // Schedule next beat flash based on nextBeatTimestamp (adjusted for offset)
        const { bpm, nextBeatTimestamp } = message;
        const adjustedTimestamp =
          offsetFromServerTime !== null
            ? nextBeatTimestamp - offsetFromServerTime
            : nextBeatTimestamp;
        scheduleBeatFlash(adjustedTimestamp);

        setCurrentBpm(bpm);
        setReceivedMessages((prev) => [
          ...prev.slice(-9), // Keep last 10 messages
          `${timestamp} - BEAT (BPM: ${bpm}) - Next: ${new Date(
            adjustedTimestamp
          ).toLocaleTimeString()}`,
        ]);
      } else if (message.type === MessageTypes.SET_TEMPO) {
        // Schedule next beat flash based on new tempo (adjusted for offset)
        const { bpm, nextBeatTimestamp } = message;
        setCurrentBpm(bpm || 120);
        const adjustedTimestamp =
          offsetFromServerTime !== null
            ? nextBeatTimestamp - offsetFromServerTime
            : nextBeatTimestamp;
        scheduleBeatFlash(adjustedTimestamp);

        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - TEMPO SET to ${bpm} BPM - Next: ${new Date(
            adjustedTimestamp
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
  }, [
    onMessage,
    offMessage,
    scheduleBeatFlash,
    calculateTimeOffset,
    offsetFromServerTime,
  ]);

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
      // Perform initial time synchronization
      setTimeout(() => performTimeSync(), 100);
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
              <div className="col-span-2">
                <span className="text-gray-300">Time offset: </span>
                <span className="font-mono text-white">
                  {offsetFromServerTime !== null
                    ? `${offsetFromServerTime.toFixed(1)}ms`
                    : "Not synced"}
                </span>
                {roundTripTime !== null && (
                  <span className="text-gray-300 ml-4">
                    RTT:{" "}
                    <span className="font-mono text-white">
                      {roundTripTime.toFixed(1)}ms
                    </span>
                  </span>
                )}
                {syncProgress && (
                  <span className="text-yellow-400 ml-4">
                    Syncing... {syncProgress.current}/{syncProgress.total}
                  </span>
                )}
                <button
                  onClick={performTimeSync}
                  disabled={syncProgress !== null}
                  className="ml-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded"
                >
                  {offsetFromServerTime !== null ? "Re-sync" : "Sync"}
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              Listening for beats from controller... Background flashes are
              scheduled based on precise timing. Time sync uses 30 samples to
              find the best offset.
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
