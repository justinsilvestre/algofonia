import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpsServer, Server } from "https";
import { createServer as createHttpServer } from "http";
import { getCert } from "@/getCert";

export interface WebSocketServerOptions {
  server: ReturnType<typeof createHttpsServer | typeof createHttpServer>;
}

export interface ClientInfo {
  roomId: string;
  userId: string;
}

export const MessageTypes = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  BEAT: "beat",
  SET_TEMPO: "set_tempo",
  USER_COUNT: "user_count",
  ERROR: "error",
} as const;

export async function startWebSocketServer(
  options: WebSocketServerOptions
): Promise<WebSocketServer> {
  const { server } = options;
  return await new Promise((resolve, reject) => {
    // Create WebSocket server
    const wss = new WebSocketServer({ server });

    // Store connected clients
    const clients = new Map<WebSocket, ClientInfo>();

    // Room management
    const rooms = new Map<string, Set<WebSocket>>();

    function joinRoom(ws: WebSocket, roomId: string, userId: string) {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      const room = rooms.get(roomId)!;
      room.add(ws);

      // Store client info
      clients.set(ws, { roomId, userId });

      // Broadcast user count to room
      broadcastToRoom(roomId, {
        type: MessageTypes.USER_COUNT,
        count: room.size,
        roomId,
      });

      console.log(
        `User ${userId} joined room ${roomId}. Room size: ${room.size}`
      );
    }

    function leaveRoom(ws: WebSocket) {
      const clientInfo = clients.get(ws);
      if (!clientInfo) return;

      const { roomId, userId } = clientInfo;
      const room = rooms.get(roomId);

      if (room) {
        room.delete(ws);

        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          // Broadcast updated user count
          broadcastToRoom(roomId, {
            type: MessageTypes.USER_COUNT,
            count: room.size,
            roomId,
          });
        }
      }

      clients.delete(ws);
      console.log(`User ${userId} left room ${roomId}`);
    }

    function broadcastToRoom(
      roomId: string,
      message: Record<string, unknown>,
      excludeWs: WebSocket | null = null
    ) {
      const room = rooms.get(roomId);
      if (!room) return;

      const messageStr = JSON.stringify(message);
      room.forEach((ws) => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }

    wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection");

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          const { type, payload } = message;

          switch (type) {
            case MessageTypes.JOIN_ROOM:
              const { roomId, userId } = payload;
              joinRoom(ws, roomId, userId);
              ws.send(
                JSON.stringify({
                  type: MessageTypes.JOIN_ROOM,
                  success: true,
                  roomId,
                  userId,
                })
              );
              break;

            case MessageTypes.BEAT:
              const clientInfo = clients.get(ws);
              if (clientInfo) {
                // Broadcast beat to all other clients in the room
                broadcastToRoom(
                  clientInfo.roomId,
                  {
                    type: MessageTypes.BEAT,
                    payload: payload,
                    from: clientInfo.userId,
                    timestamp: Date.now(),
                  },
                  ws
                );
              }
              break;

            case MessageTypes.SET_TEMPO:
              const clientInfoTempo = clients.get(ws);
              if (clientInfoTempo) {
                // Broadcast tempo change to all other clients in the room
                broadcastToRoom(
                  clientInfoTempo.roomId,
                  {
                    type: MessageTypes.SET_TEMPO,
                    payload: payload,
                    from: clientInfoTempo.userId,
                    timestamp: Date.now(),
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
                  message: `Unknown message type: ${type}`,
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
