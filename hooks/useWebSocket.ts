"use client";

import { MessageTypes, WebSocketMessage } from "@/app/server/MessageTypes";
import { useState, useEffect, useRef, useCallback } from "react";

export interface UseWebSocketOptions {
  url?: string | null;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  userCount: number;
  roomId: string | null;
  userId: number | null;
  error: string | null;
  joinRoom: () => void;
  leaveRoom: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  offMessage: (callback: (message: WebSocketMessage) => void) => void;
}

export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { url, reconnectInterval = 3000, maxReconnectAttempts = 5 } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageCallbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(
    new Set()
  );

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log("Connecting to WebSocket:", url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle built-in message types
          switch (message.type) {
            case MessageTypes.USER_COUNT:
              setUserCount(message.count || 0);
              break;
            case MessageTypes.ASSIGN_USER_ID:
              setRoomId("main"); // Single room
              setUserId(message.userId);
              break;
            case MessageTypes.ERROR:
              setError(message.message || "Unknown error");
              break;
          }

          // Notify all message callbacks
          messageCallbacksRef.current.forEach((callback) => {
            try {
              callback(message);
            } catch (err) {
              console.error("Error in message callback:", err);
            }
          });
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setIsConnecting(false);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, reconnectInterval);
        } else {
          setError("Failed to reconnect to WebSocket server");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error");
        setIsConnecting(false);
      };
    } catch (err) {
      console.error("Failed to create WebSocket connection:", err);
      setError("Failed to create WebSocket connection");
      setIsConnecting(false);
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  // Update the ref whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setRoomId(null);
    setUserId(null);
    setUserCount(0);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
    }
  }, []);

  const joinRoom = useCallback(() => {
    sendMessage({
      type: MessageTypes.JOIN_ROOM_REQUEST,
    });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: MessageTypes.LEAVE_ROOM });
    setRoomId(null);
    setUserId(null);
    setUserCount(0);
  }, [sendMessage]);

  const onMessage = useCallback(
    (callback: (message: WebSocketMessage) => void) => {
      messageCallbacksRef.current.add(callback);
    },
    []
  );

  const offMessage = useCallback(
    (callback: (message: WebSocketMessage) => void) => {
      messageCallbacksRef.current.delete(callback);
    },
    []
  );

  // Connect on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    userCount,
    roomId,
    userId,
    error,
    joinRoom,
    leaveRoom,
    sendMessage,
    onMessage,
    offMessage,
  };
}
