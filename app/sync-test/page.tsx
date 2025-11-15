"use client";

import { useState, useEffect } from "react";
import {
  useWebSocket,
  MessageTypes,
  WebSocketMessage,
} from "../../hooks/useWebSocket";
import { useWebsocketUrl } from "./control/useWebsocketUrl";

export default function SyncTestPage() {
  const [roomId, setRoomId] = useState("sync-room");
  const [userId, setUserId] = useState(
    () => `listener_${Math.random().toString(36).substr(2, 9)}`
  );
  const [currentBpm, setCurrentBpm] = useState(120);
  const [beatCount, setBeatCount] = useState(0);
  const [flashBg, setFlashBg] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);

  const {
    isConnected,
    isConnecting,
    userCount,
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

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      const timestamp = new Date().toLocaleTimeString();

      if (message.type === MessageTypes.BEAT) {
        // Flash background on beat
        setFlashBg(true);
        setTimeout(() => setFlashBg(false), 100);

        setBeatCount((prev) => prev + 1);
        const payload = message.payload as {
          bpm?: number;
          timestamp?: number;
          beatNumber?: number;
        };
        setReceivedMessages((prev) => [
          ...prev.slice(-9), // Keep last 10 messages
          `${timestamp} - BEAT from ${message.from} (BPM: ${payload?.bpm})`,
        ]);
      } else if (message.type === MessageTypes.SET_TEMPO) {
        const payload = message.payload as { bpm?: number };
        setCurrentBpm(payload?.bpm || 120);
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - TEMPO SET to ${payload?.bpm} BPM`,
        ]);
      } else if (message.type === MessageTypes.JOIN_ROOM && message.success) {
        setIsInRoom(true);
        setReceivedMessages((prev) => [
          ...prev.slice(-9),
          `${timestamp} - Joined room successfully`,
        ]);
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]);

  const handleJoinRoom = () => {
    if (roomId && userId) {
      joinRoom(roomId, userId);
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setIsInRoom(false);
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
      className={`min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 transition-all duration-100 ${
        flashBg ? "bg-white" : ""
      }`}
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
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Room ID"
                className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={isInRoom}
              />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID"
                className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={isInRoom}
              />
            </div>
            <div className="flex gap-3">
              {!isInRoom ? (
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected || !roomId || !userId}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white rounded transition-colors"
                >
                  Join Room
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
              Listening for beats from controller... Background will flash on
              each beat.
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
