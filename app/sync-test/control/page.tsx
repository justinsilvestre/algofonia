"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { MessageTypes } from "@/app/server/MessageTypes";

export default function SyncTestControlPage() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [flashBg, setFlashBg] = useState(false);
  const [beatCount, setBeatCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    userCount,
    userId,
    error,
    joinRoom,
    leaveRoom,
    sendMessage,
    onMessage,
    offMessage,
  } = useWebSocket({
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: { type: string; userId?: number }) => {
      if (message.type === MessageTypes.ASSIGN_USER_ID) {
        setIsInRoom(true);
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]);

  // Flash effect
  const triggerFlash = useCallback(() => {
    setFlashBg(true);
    setTimeout(() => setFlashBg(false), 100);
  }, []);

  // Beat interval management
  const startBeats = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const beatInterval = (60 / bpm) * 1000; // Convert BPM to milliseconds

    intervalRef.current = setInterval(() => {
      setBeatCount((prev) => prev + 1);

      const now = performance.now() + performance.timeOrigin;
      const nextBeatTimestamp = now + beatInterval;

      // Send beat message
      sendMessage({
        type: MessageTypes.BEAT,
        bpm,
        timestamp: now,
        beatNumber: beatCount + 1,
        nextBeatTimestamp,
      });

      // Flash background
      triggerFlash();
    }, beatInterval);
  }, [bpm, sendMessage, triggerFlash, beatCount]);

  const stopBeats = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setBeatCount(0);
  }, []);

  // Handle BPM changes
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);

    // Send tempo change message
    if (isInRoom && isConnected) {
      const now = performance.now() + performance.timeOrigin;
      const newBeatInterval = (60 / newBpm) * 1000;
      const nextBeatTimestamp = now + newBeatInterval;

      sendMessage({
        type: MessageTypes.SET_TEMPO,
        bpm: newBpm,
        timestamp: now,
        nextBeatTimestamp,
      });
    }

    // Restart beats if playing
    if (isPlaying) {
      stopBeats();
      setTimeout(() => startBeats(), 50); // Small delay to ensure clean restart
    }
  };

  const handleJoinRoom = () => {
    if (isConnected) {
      joinRoom();
    }
  };

  const handleLeaveRoom = () => {
    setIsPlaying(false);
    stopBeats();
    leaveRoom();
    setIsInRoom(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopBeats();
    } else {
      setIsPlaying(true);
      startBeats();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBeats();
    };
  }, [stopBeats]);

  const connectionStatus = isConnected ? "Connected" : "Disconnected";

  return (
    <div
      className={`min-h-screen p-4 transition-all duration-100 ${
        flashBg
          ? "bg-white"
          : "bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900"
      }`}
    >
      <div className="max-w-2xl mx-auto">
        <h1
          className={`text-3xl font-bold text-center mb-8 transition-colors duration-100 ${
            flashBg ? "text-black" : "text-white"
          }`}
        >
          Beat Controller
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
            <div>
              <span className="text-gray-300">Users in room: </span>
              <span className="font-mono text-white">{userCount}</span>
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
                Your User ID:{" "}
                <span className="font-mono text-white">{userId}</span>
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

        {/* BPM Controls */}
        {isInRoom && (
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 mb-6 border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-4">
              Beat Control
            </h2>

            {/* BPM Slider */}
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-mono text-white mb-2">
                  {bpm} BPM
                </div>
                <div className="text-sm text-gray-300">Beat #{beatCount}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-white text-sm font-medium">
                  Tempo (BPM)
                </label>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>60</span>
                  <span>130</span>
                  <span>200</span>
                </div>
              </div>

              {/* Play/Stop Controls */}
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={togglePlayback}
                  disabled={!isConnected}
                  className={`px-8 py-3 rounded-lg font-semibold text-white text-lg transition-all duration-200 ${
                    isPlaying
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  } disabled:bg-gray-600`}
                >
                  {isPlaying ? "⏹ Stop" : "▶ Play"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">
            Instructions
          </h2>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• Join a room to start controlling the beat</li>
            <li>• Adjust the BPM slider to change tempo (60-200 BPM)</li>
            <li>• Click Play to start sending beats to connected clients</li>
            <li>• Background flashes on each beat</li>
            <li>
              • Other clients in the same room will receive beats and tempo
              changes
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
