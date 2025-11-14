import { WebSocketServer } from "ws";
import { createServer } from "http";

const PORT = process.env.WS_PORT || 8080;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map();

// Message types
const MessageTypes = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  SYNC_DATA: "sync_data",
  USER_COUNT: "user_count",
  ERROR: "error",
};

// Room management
const rooms = new Map();

function joinRoom(ws, roomId, userId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId);
  room.add(ws);

  // Store client info
  clients.set(ws, { roomId, userId });

  // Broadcast user count to room
  broadcastToRoom(roomId, {
    type: MessageTypes.USER_COUNT,
    count: room.size,
    roomId,
  });

  console.log(`User ${userId} joined room ${roomId}. Room size: ${room.size}`);
}

function leaveRoom(ws) {
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

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

wss.on("connection", (ws) => {
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

        case MessageTypes.SYNC_DATA:
          const clientInfo = clients.get(ws);
          if (clientInfo) {
            // Broadcast sync data to all other clients in the room
            broadcastToRoom(
              clientInfo.roomId,
              {
                type: MessageTypes.SYNC_DATA,
                payload: payload,
                from: clientInfo.userId,
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

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
