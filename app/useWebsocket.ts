"use client";
import { useState, useEffect, useCallback } from "react";
import { MessageToClient, MessageToServer } from "./WebsocketMessage";
import { useWebsocketUrl } from "@/app/useWebsocketUrl";

type ConnectionState =
  | {
      type: "initial" | "connecting" | "connected" | "disconnected";
    }
  | {
      type: "error";
      message: string;
    };

export function useWebsocket(options: {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  handleMessage: (
    message: MessageToClient,
    sendMessage: (message: MessageToServer) => void
  ) => void;
}) {
  const url = useWebsocketUrl();
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    handleMessage,
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    type: "initial",
  });
  const [reconnectAttemptsCount, setReconnectAttemptsCount] = useState(0);

  useEffect(() => {
    if (!url) return;
    if (socket?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }
    if (socket?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connection in progress");
      return;
    }
    if (socket?.readyState === WebSocket.CLOSING) {
      console.log("WebSocket is closing, will not attempt to reconnect now");
      return;
    }
    if (socket?.readyState === WebSocket.CLOSED) {
      console.log("WebSocket is closed, attempting to reconnect");
    }

    try {
      console.log(`Connecting to WebSocket at ${url}...`);
      setConnectionState({ type: "connecting" });
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log("WebSocket connected");
        setConnectionState({ type: "connected" });
        setReconnectAttemptsCount(0);
      };
      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionState({ type: "disconnected" });
        if (reconnectAttemptsCount < maxReconnectAttempts) {
          console.log(
            `Reconnecting in ${reconnectInterval}ms... (attempt ${
              reconnectAttemptsCount + 1
            }/${maxReconnectAttempts})`
          );
          setTimeout(() => {
            setReconnectAttemptsCount((count) => count + 1);
            setSocket(null); // Trigger reconnection
          }, reconnectInterval);
        } else {
          console.log("Max reconnect attempts reached");
          setConnectionState({
            type: "error",
            message: "Max reconnect attempts reached",
          });
        }
      };
      socket.onerror = (error) => {
        console.log("WebSocket error:", error);
        setConnectionState({
          type: "error",
          message: `WebSocket error: ${error.type}`,
        });
      };

      setSocket(socket);
    } catch (error) {
      console.error(`Failed to create WebSocket connection:`, error);
      setConnectionState({
        type: "error",
        message: "Failed to create WebSocket connection",
      });
    }
  }, [
    url,
    socket,
    reconnectAttemptsCount,
    maxReconnectAttempts,
    reconnectInterval,
  ]);

  const sendMessage = useCallback(
    (message: MessageToServer) => {
      console.log("Sending message to server:", message);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return { OK: true };
      } else {
        console.warn(
          `WebSocket is not connected; cannot send message ${JSON.stringify(
            message
          )}`
        );
        return { OK: false, error: "WebSocket is not connected" };
      }
    },
    [socket]
  );

  useEffect(() => {
    if (!socket || !handleMessage) return;
    // eslint-disable-next-line react-hooks/immutability
    socket.onmessage = (event) => {
      try {
        const message: MessageToClient = JSON.parse(event.data);
        handleMessage(message, sendMessage);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }, [socket, handleMessage, sendMessage]);

  return {
    socket,
    connectionState,
    sendMessage,
  };
}
