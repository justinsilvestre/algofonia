import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { MessageToClient, MessageToServer } from "../WebsocketMessage";

type ConnectionsState = {
  connectedClients: Set<WebSocket>;
  nextUserId: number;
  rooms: Map<string, Room>;
};
type Room = {
  outputClients: Map<WebSocket, number>;
  inputClients: Map<WebSocket, number>;
  currentBpm: number;
  lastBeatTimestamp: number;
};

type WebSocketServerOptions = {
  httpServer: ReturnType<typeof createHttpsServer | typeof createHttpServer>;
};

export async function startWebSocketServer(
  options: WebSocketServerOptions
): Promise<WebSocketServer> {
  const websocketServer = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  const connectedClients = new Set<WebSocket>();
  const rooms = new Map<string, Room>();
  const connectionsState: ConnectionsState = {
    connectedClients,
    rooms,
    nextUserId: 1,
  };

  websocketServer.on("connection", (socket: WebSocket) => {
    console.log("New WebSocket connection");

    socket.on("message", (data) => {
      console.log("Received WebSocket message:", data.toString());
      handleMessage(options, connectionsState, socket, data);
    });

    socket.on("close", () => {
      console.log("WebSocket connection closed");
      connectedClients.delete(socket);
      rooms.forEach((room) => {
        room.outputClients.delete(socket);
        room.inputClients.delete(socket);
      });
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down WebSocket server...");
    websocketServer.close(() => {
      options.httpServer.close(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return websocketServer;
}

function handleMessage(
  options: WebSocketServerOptions,
  connectionsState: ConnectionsState,
  socket: WebSocket,
  data: WebSocket.RawData
) {
  const message = JSON.parse(data.toString()) as MessageToServer;
  switch (message.type) {
    case "JOIN_ROOM_REQUEST": {
      const room: Room = connectionsState.rooms.get(message.roomName) || {
        currentBpm: 120,
        lastBeatTimestamp: performance.now() + performance.timeOrigin,
        inputClients: new Map<WebSocket, number>(),
        outputClients: new Map<WebSocket, number>(),
      };
      connectionsState.rooms.set(message.roomName, room);
      const userId = connectionsState.nextUserId++;
      connectionsState.connectedClients.add(socket);
      room[
        message.clientType === "input" ? "inputClients" : "outputClients"
      ].set(socket, userId);

      const inputClients = Array.from(room.inputClients.values());
      const outputClients = Array.from(room.outputClients.values());

      sendToClient(socket, {
        type: "JOIN_ROOM_REPLY",
        userId,
        roomState: {
          inputClients,
          outputClients,
        },
        bpm: room.currentBpm,
        nextBeatTimestamp: getNextBeatTimestamp(room),
      });
      return broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "ROOM_STATE_UPDATE",
        roomName: message.roomName,
        roomState: {
          inputClients,
          outputClients,
        },
      });
    }

    case "SYNC":
      return sendToClient(socket, {
        type: "SYNC_REPLY",
        t0: message.t0,
        s0: performance.now() + performance.timeOrigin,
      });

    case "SET_TEMPO": {
      const room = connectionsState.rooms.get(message.roomName);
      if (!room) {
        console.error(`Room ${message.roomName} not found for SET_TEMPO`);
        return;
      }
      const now = performance.now() + performance.timeOrigin;
      room.currentBpm = message.bpm;
      room.lastBeatTimestamp = now;

      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "SET_TEMPO",
        bpm: message.bpm,
        actionTimestamp: message.actionTimestamp,
        nextBeatTimestamp: message.nextBeatTimestamp,
      });
      return;
    }

    case "MOTION_INPUT": {
      const room = connectionsState.rooms.get(message.roomName);
      if (!room) {
        console.error(`Room ${message.roomName} not found for MOTION_INPUT`);
        return;
      }
      for (const [outputClient] of room.outputClients) {
        if (outputClient.readyState === WebSocket.OPEN) {
          sendToClient(outputClient, message);
        }
      }
      return;
    }

    default: {
      console.warn("Unknown message type:", message);
    }
  }
}

function sendToClient(socket: WebSocket, message: MessageToClient) {
  socket.send(JSON.stringify(message));
}

function broadcastToAllClientsInRoom(
  connectionsState: ConnectionsState,
  roomName: string,
  message: MessageToClient
) {
  const messageString = JSON.stringify(message);
  const room = connectionsState.rooms.get(roomName);
  if (room) {
    room.outputClients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }
}

function getNextBeatTimestamp(room: Room): number {
  const now = performance.now() + performance.timeOrigin;
  const beatInterval = (60 / room.currentBpm) * 1000;
  const timeSinceLastBeat = now - room.lastBeatTimestamp;
  return (
    room.lastBeatTimestamp +
    Math.ceil(timeSinceLastBeat / beatInterval) * beatInterval
  );
}
