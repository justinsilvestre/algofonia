import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpsServer, Server } from "https";
import { createServer as createHttpServer } from "http";
import { performance } from "perf_hooks";
import { MessageTypes, WebSocketMessage } from "./MessageTypes";

export interface WebSocketServerOptions {
  server: ReturnType<typeof createHttpsServer | typeof createHttpServer>;
}

export interface ClientInfo {
  userId: number;
}

export async function startWebSocketServer(
  options: WebSocketServerOptions
): Promise<WebSocketServer> {
  const { server } = options;
  return await new Promise((resolve, reject) => {
    // Create WebSocket server
    const wss = new WebSocketServer({ server });

    // Store connected clients
    const clients = new Map<WebSocket, ClientInfo>();

    // Single room management - all clients are in one room
    const connectedClients = new Set<WebSocket>();

    // Track user IDs and next available ID
    const connectedUserIds = new Set<number>();
    let nextUserId = 1;

    // Track beat timing
    let currentBpm = 120; // Default BPM
    let lastBeatTimestamp = performance.now() + performance.timeOrigin;

    function calculateNextBeatTimestamp(
      bpm: number,
      currentTimestamp: number
    ): number {
      const beatInterval = (60 / bpm) * 1000; // Convert BPM to milliseconds
      return currentTimestamp + beatInterval;
    }

    function joinRoom(ws: WebSocket): number {
      // Find next available user ID
      while (connectedUserIds.has(nextUserId)) {
        nextUserId++;
      }

      const userId = nextUserId;
      nextUserId++;

      // Add to connected clients
      connectedClients.add(ws);
      connectedUserIds.add(userId);

      // Store client info
      clients.set(ws, { userId });

      // Broadcast updated user count to all clients
      broadcastToAllClients({
        type: MessageTypes.USER_COUNT,
        count: connectedClients.size,
        roomId: "main",
      });

      console.log(
        `User ${userId} joined. Total users: ${connectedClients.size}`
      );

      return userId;
    }

    function leaveRoom(ws: WebSocket) {
      const clientInfo = clients.get(ws);
      if (!clientInfo) return;

      const { userId } = clientInfo;

      // Remove from connected clients
      connectedClients.delete(ws);
      connectedUserIds.delete(userId);
      clients.delete(ws);

      // Broadcast updated user count to remaining clients
      broadcastToAllClients({
        type: MessageTypes.USER_COUNT,
        count: connectedClients.size,
        roomId: "main",
      });

      console.log(`User ${userId} left. Total users: ${connectedClients.size}`);
    }

    function broadcastToAllClients(
      message: WebSocketMessage,
      excludeWs: WebSocket | null = null
    ) {
      const messageStr = JSON.stringify(message);
      connectedClients.forEach((ws: WebSocket) => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }

    wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection");

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;

          switch (message.type) {
            case MessageTypes.SYNC:
              const t2 = performance.now() + performance.timeOrigin; // Server timestamp when sync request was received
              const t3 = performance.now() + performance.timeOrigin; // Server timestamp when sync reply was sent
              ws.send(
                JSON.stringify({
                  type: MessageTypes.SYNC_REPLY,
                  t1: message.t1,
                  t2: t2,
                  t3: t3,
                })
              );
              break;

            case MessageTypes.JOIN_ROOM_REQUEST:
              const assignedUserId = joinRoom(ws);
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ASSIGN_USER_ID,
                  userId: assignedUserId,
                })
              );

              break;

            case MessageTypes.BEAT:
              const clientInfo = clients.get(ws);
              if (clientInfo) {
                const now = performance.now() + performance.timeOrigin;
                currentBpm = message.bpm;
                lastBeatTimestamp = now;

                const nextBeatTimestamp = calculateNextBeatTimestamp(
                  currentBpm,
                  now
                );

                // Broadcast beat to all other clients
                broadcastToAllClients(
                  {
                    type: MessageTypes.BEAT,
                    timestamp: now,
                    bpm: message.bpm,
                    beatNumber: message.beatNumber,
                    nextBeatTimestamp,
                  },
                  ws
                );
              }
              break;

            case MessageTypes.SET_TEMPO:
              const clientInfoTempo = clients.get(ws);
              if (clientInfoTempo) {
                const now = performance.now() + performance.timeOrigin;
                currentBpm = message.bpm;

                // Calculate next beat timestamp based on the new tempo and last beat
                const timeSinceLastBeat = now - lastBeatTimestamp;
                const newBeatInterval = (60 / currentBpm) * 1000;
                const nextBeatTimestamp =
                  lastBeatTimestamp +
                  Math.ceil(timeSinceLastBeat / newBeatInterval) *
                    newBeatInterval;

                // Broadcast tempo change to all other clients
                broadcastToAllClients(
                  {
                    type: MessageTypes.SET_TEMPO,
                    bpm: message.bpm,
                    timestamp: now,
                    nextBeatTimestamp,
                  },
                  ws
                );
              }
              break;

            case MessageTypes.LEAVE_ROOM:
              leaveRoom(ws);
              break;

            default:
              ws.send(
                JSON.stringify({
                  type: MessageTypes.ERROR,
                  message: `Unknown message type: ${message.type}`,
                })
              );
          }
        } catch (error) {
          console.error("Error processing message:", error);
          ws.send(
            JSON.stringify({
              type: MessageTypes.ERROR,
              message: "Invalid message format",
            })
          );
        }
      });

      ws.on("close", () => {
        leaveRoom(ws);
        console.log("WebSocket connection closed");
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        leaveRoom(ws);
      });
    });

    server.on("error", (error) => {
      console.error("WebSocket server error:", error);
      reject(error);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log("Shutting down WebSocket server...");
      wss.close(() => {
        server.close(() => {
          process.exit(0);
        });
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    return resolve(wss);
  });
}
