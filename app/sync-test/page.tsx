"use client";

import { useState, useEffect } from "react";
import { useWebSocket, MessageTypes } from "../../hooks/useWebSocket";

export default function SyncTestPage() {
  const [roomId, setRoomId] = useState("test-room");
  const [userId, setUserId] = useState(
    () => `user_${Math.random().toString(36).substr(2, 9)}`
  );
  const [syncData, setSyncData] = useState({ x: 0, y: 0, timestamp: 0 });
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);

  const {
    isConnected,
    isConnecting,
    userCount,
    error,
    joinRoom,
    leaveRoom,
    sendSyncData,
    onMessage,
    offMessage,
  } = useWebSocket({
    url: "ws://localhost:8080",
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: {
      type: string;
      payload?: unknown;
      from?: string;
      success?: boolean;
    }) => {
      const timestamp = new Date().toLocaleTimeString();

      if (message.type === MessageTypes.SYNC_DATA) {
        setReceivedMessages((prev) => [
          ...prev.slice(-9), // Keep last 10 messages
          `${timestamp} - ${message.from}: ${JSON.stringify(message.payload)}`,
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

  const handleSendData = () => {
    const data = {
      x: Math.round(Math.random() * 100),
      y: Math.round(Math.random() * 100),
      timestamp: Date.now(),
    };
    setSyncData(data);
    sendSyncData(data);
  };

  const connectionStatus = isConnecting
    ? "Connecting..."
    : isConnected
    ? "Connected"
    : "Disconnected";

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          WebSocket Sync Test
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

        {/* Sync Data */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <h2 className="text-lg font-semibold text-white mb-3">Sync Data</h2>
          <div className="space-y-3">
            <div className="text-sm text-gray-300">
              Current data:{" "}
              <span className="font-mono text-white">
                x: {syncData.x}, y: {syncData.y}
              </span>
            </div>
            <button
              onClick={handleSendData}
              disabled={!isConnected || !isInRoom}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              Send Random Data
            </button>
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
