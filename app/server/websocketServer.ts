import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import {
  MessageToClient,
  MessageToServer,
  TutorialStepName,
} from "../WebsocketMessage";

type ConnectionsState = {
  connectedClients: Set<WebSocket>;
  nextUserId: number;
  rooms: Map<string, Room>;
  subscribers: Map<string, Set<WebSocket>>;
};
type Room = {
  outputClients: Map<WebSocket, number>;
  inputClients: Map<WebSocket, number>;
  subscriptionsCount: number;
  beat: {
    currentBpm: number;
    startTime: number;
    lastSyncedBeatNumber: number;
    lastSyncedBeatTimestamp: number;
  } | null;
  tutorial: {
    queue: number[];
    currentUserId: number | null;
    currentStep: TutorialStepName | null;
  } | null;
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
  const subscribers = new Map<string, Set<WebSocket>>();
  const connectionsState: ConnectionsState = {
    connectedClients,
    rooms,
    nextUserId: 1,
    subscribers,
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
      subscribers.forEach((roomSubscribers, roomName) => {
        roomSubscribers.delete(socket);
        if (roomSubscribers.size === 0) {
          subscribers.delete(roomName);
        }
      });
      rooms.forEach((room, roomName) => {
        // Get userId before removing from clients maps
        const outputUserId = room.outputClients.get(socket);
        const inputUserId = room.inputClients.get(socket);
        const disconnectedUserId = outputUserId || inputUserId;

        room.outputClients.delete(socket);
        room.inputClients.delete(socket);

        // Clean up tutorial state if disconnected user was in tutorial
        if (disconnectedUserId && room.tutorial) {
          // Remove from tutorial queue
          room.tutorial.queue = room.tutorial.queue.filter(
            (id) => id !== disconnectedUserId
          );

          // If current tutorial user disconnected, move to next or clear
          if (room.tutorial.currentUserId === disconnectedUserId) {
            if (room.tutorial.queue.length > 0) {
              // Start tutorial for next user in queue
              room.tutorial.currentUserId = room.tutorial.queue[0];
              room.tutorial.currentStep = "intro";

              // Notify about tutorial start for next user
              broadcastToAllClientsInRoom(connectionsState, roomName, {
                type: "TUTORIAL_START",
                roomName,
                userId: room.tutorial.currentUserId,
                step: "intro",
              });
            } else {
              // No more users in tutorial
              room.tutorial.currentUserId = null;
              room.tutorial.currentStep = null;
              room.tutorial = null;

              // Notify about tutorial end
              broadcastToAllClientsInRoom(connectionsState, roomName, {
                type: "TUTORIAL_END",
                roomName,
                userId: disconnectedUserId,
              });
            }
          }
        }

        const noClientsLeft =
          room.outputClients.size === 0 && room.inputClients.size === 0;
        if (noClientsLeft) {
          console.log(`No clients left in room ${roomName}, deleting room`);
          rooms.delete(roomName);
        } else
          broadcastToAllClientsInRoom(connectionsState, roomName, {
            type: "ROOM_STATE_UPDATE",
            roomName,
            roomState: {
              inputClients: Array.from(room.inputClients.values()),
              outputClients: Array.from(room.outputClients.values()),
              subscriptionsCount: room.subscriptionsCount,
              beat: room.beat
                ? {
                    bpm: room.beat.currentBpm,
                    startTimestamp: room.beat.startTime,
                    ...getBeatTimes(room.beat),
                  }
                : null,
              tutorial: room.tutorial,
            },
          });
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
        beat:
          message.clientType === "output"
            ? {
                currentBpm: message.bpm,
                startTime: Date.now(),
                lastSyncedBeatNumber: 0,
                lastSyncedBeatTimestamp:
                  performance.now() + performance.timeOrigin,
              }
            : null,
        inputClients: new Map<WebSocket, number>(),
        outputClients: new Map<WebSocket, number>(),
        subscriptionsCount: 0,
        tutorial: null,
      };
      if (room && !room.beat && message.clientType === "output") {
        room.beat = {
          currentBpm: message.bpm,
          startTime: Date.now(),
          lastSyncedBeatNumber: 0,
          lastSyncedBeatTimestamp: performance.now() + performance.timeOrigin,
        };
      }

      console.log("Client joining room:", message.roomName, room.beat);

      const userId = connectionsState.nextUserId++;
      connectionsState.rooms.set(message.roomName, room);
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
          subscriptionsCount: room.subscriptionsCount,
          beat: room.beat
            ? {
                bpm: room.beat.currentBpm,
                startTimestamp: room.beat.startTime,
                ...getBeatTimes(room.beat),
              }
            : null,
          tutorial: room.tutorial,
        },
      });
      return broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "ROOM_STATE_UPDATE",
        roomName: message.roomName,
        roomState: {
          inputClients,
          outputClients,
          subscriptionsCount: room.subscriptionsCount,
          beat: room.beat
            ? {
                bpm: room.beat.currentBpm,
                startTimestamp: room.beat.startTime,
                ...getBeatTimes(room.beat),
              }
            : null,
          tutorial: room.tutorial,
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
      if (!room?.beat) {
        console.error(
          `Room with beat running ${message.roomName} not found for SET_TEMPO`
        );
        return;
      }
      const now = performance.now() + performance.timeOrigin;
      room.beat.currentBpm = message.bpm;
      room.beat.lastSyncedBeatTimestamp = now;

      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "SET_TEMPO",
        roomName: message.roomName,
        bpm: message.bpm,
        actionTimestamp: message.actionTimestamp,
        nextBeatNumber: message.nextBeatNumber,
        nextBeatTimestamp: message.nextBeatTimestamp,
      });
      return;
    }

    case "SYNC_BEAT": {
      console.log(
        "SYNC_BEAT received for room",
        message.roomName,
        "beatNumber",
        message.beatNumber,
        "beatTimestamp",
        message.beatTimestamp
      );
      const room = connectionsState.rooms.get(message.roomName);
      if (!room?.beat) {
        console.error(
          `Room with beat running ${message.roomName} not found for SYNC_BEAT`
        );
        return;
      }

      room.beat.lastSyncedBeatNumber = message.beatNumber;
      room.beat.lastSyncedBeatTimestamp = message.beatTimestamp;

      for (const [outputClient] of room.outputClients) {
        if (
          outputClient !== socket &&
          outputClient.readyState === WebSocket.OPEN
        ) {
          sendToClient(outputClient, {
            type: "SYNC_BEAT",
            roomName: message.roomName,
            beatNumber: message.beatNumber,
            beatTimestamp: message.beatTimestamp,
            bpm: room.beat.currentBpm,
          });
        }
      }
      for (const [inputClient] of room.inputClients) {
        if (inputClient.readyState === WebSocket.OPEN) {
          sendToClient(inputClient, {
            type: "SYNC_BEAT",
            roomName: message.roomName,
            beatNumber: message.beatNumber,
            beatTimestamp: message.beatTimestamp,
            bpm: room.beat.currentBpm,
          });
        }
      }
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
      // also send to room subscribers
      const roomSubscribers = connectionsState.subscribers.get(
        message.roomName
      );
      if (roomSubscribers) {
        roomSubscribers.forEach((subscriber) => {
          if (subscriber.readyState === WebSocket.OPEN) {
            sendToClient(subscriber, message);
          }
        });
      }
      return;
    }

    case "SUBSCRIBE_TO_ROOM_REQUEST": {
      const room: Room = connectionsState.rooms.get(message.roomName) || {
        beat: null,
        inputClients: new Map<WebSocket, number>(),
        outputClients: new Map<WebSocket, number>(),
        subscriptionsCount: 0,
        tutorial: null,
      };
      connectionsState.rooms.set(message.roomName, room);
      const roomSubscribers =
        connectionsState.subscribers.get(message.roomName) ||
        new Set<WebSocket>();
      roomSubscribers.add(socket);
      connectionsState.subscribers.set(message.roomName, roomSubscribers);

      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "ROOM_STATE_UPDATE",
        roomName: message.roomName,
        roomState: {
          inputClients: room ? Array.from(room.inputClients.values()) : [],
          outputClients: room ? Array.from(room.outputClients.values()) : [],
          subscriptionsCount: roomSubscribers.size,
          beat: room?.beat
            ? {
                bpm: room.beat.currentBpm,
                startTimestamp: room.beat.startTime,
                ...getBeatTimes(room.beat),
              }
            : null,
          tutorial: room?.tutorial || null,
        },
      });
      sendToClient(socket, {
        type: "SUBSCRIBE_TO_ROOM_REPLY",
        roomName: message.roomName,
      });
      return;
    }

    case "SCHEDULE_BEAT": {
      const roomSubscribers = connectionsState.subscribers.get(
        message.roomName
      );
      if (roomSubscribers) {
        const messageToSend: MessageToClient = {
          type: "SCHEDULE_BEAT",
          roomName: message.roomName,
          beatNumber: message.beatNumber,
          beatTimestamp: message.beatTimestamp,
        };
        roomSubscribers.forEach((subscriber) => {
          if (subscriber.readyState === WebSocket.OPEN) {
            sendToClient(subscriber, messageToSend);
          }
        });
      }
      return;
    }

    case "TUTORIAL_START": {
      const room = connectionsState.rooms.get(message.roomName);
      if (!room) {
        console.error(`Room ${message.roomName} not found for TUTORIAL_START`);
        return;
      }

      // Initialize tutorial state if not exists
      if (!room.tutorial) {
        room.tutorial = {
          queue: [],
          currentUserId: null,
          currentStep: null,
        };
      }

      // Add user to tutorial queue if not already in queue
      if (!room.tutorial.queue.includes(message.userId)) {
        room.tutorial.queue.push(message.userId);
      }

      // Start tutorial for first user in queue
      if (
        room.tutorial.currentUserId === null &&
        room.tutorial.queue.length > 0
      ) {
        room.tutorial.currentUserId = room.tutorial.queue[0];
        room.tutorial.currentStep = "intro";
      }

      // Relay to all clients in room
      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "TUTORIAL_START",
        roomName: message.roomName,
        userId: message.userId,
        step: room.tutorial.currentStep || "intro",
      });

      // Update room state
      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "ROOM_STATE_UPDATE",
        roomName: message.roomName,
        roomState: {
          inputClients: Array.from(room.inputClients.values()),
          outputClients: Array.from(room.outputClients.values()),
          subscriptionsCount: room.subscriptionsCount,
          beat: room.beat
            ? {
                bpm: room.beat.currentBpm,
                startTimestamp: room.beat.startTime,
                ...getBeatTimes(room.beat),
              }
            : null,
          tutorial: room.tutorial,
        },
      });
      return;
    }

    case "TUTORIAL_END": {
      const room = connectionsState.rooms.get(message.roomName);
      if (!room?.tutorial) {
        console.error(
          `Room ${message.roomName} tutorial state not found for TUTORIAL_END`
        );
        return;
      }

      // Remove user from tutorial queue
      room.tutorial.queue = room.tutorial.queue.filter(
        (id) => id !== message.userId
      );

      // If current user is ending tutorial, move to next or clear
      if (room.tutorial.currentUserId === message.userId) {
        if (room.tutorial.queue.length > 0) {
          // Start tutorial for next user in queue
          room.tutorial.currentUserId = room.tutorial.queue[0];
          room.tutorial.currentStep = "intro";
        } else {
          // No more users in tutorial
          room.tutorial.currentUserId = null;
          room.tutorial.currentStep = null;
          // Clear tutorial state if queue is empty
          room.tutorial = null;
        }
      }

      // Relay to all clients in room
      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "TUTORIAL_END",
        roomName: message.roomName,
        userId: message.userId,
      });

      // Update room state
      broadcastToAllClientsInRoom(connectionsState, message.roomName, {
        type: "ROOM_STATE_UPDATE",
        roomName: message.roomName,
        roomState: {
          inputClients: Array.from(room.inputClients.values()),
          outputClients: Array.from(room.outputClients.values()),
          subscriptionsCount: room.subscriptionsCount,
          beat: room.beat
            ? {
                bpm: room.beat.currentBpm,
                startTimestamp: room.beat.startTime,
                ...getBeatTimes(room.beat),
              }
            : null,
          tutorial: room.tutorial,
        },
      });
      return;
    }

    case "TUTORIAL_PROGRESS": {
      const room = connectionsState.rooms.get(message.roomName);
      if (!room?.tutorial) {
        console.error(
          `Room ${message.roomName} tutorial state not found for TUTORIAL_PROGRESS`
        );
        return;
      }

      // Only update step if this is the current tutorial user
      if (room.tutorial.currentUserId === message.userId) {
        room.tutorial.currentStep = message.step;

        // Relay to all clients in room
        broadcastToAllClientsInRoom(connectionsState, message.roomName, {
          type: "TUTORIAL_PROGRESS",
          roomName: message.roomName,
          userId: message.userId,
          step: message.step,
        });

        // Update room state
        broadcastToAllClientsInRoom(connectionsState, message.roomName, {
          type: "ROOM_STATE_UPDATE",
          roomName: message.roomName,
          roomState: {
            inputClients: Array.from(room.inputClients.values()),
            outputClients: Array.from(room.outputClients.values()),
            subscriptionsCount: room.subscriptionsCount,
            beat: room.beat
              ? {
                  bpm: room.beat.currentBpm,
                  startTimestamp: room.beat.startTime,
                  ...getBeatTimes(room.beat),
                }
              : null,
            tutorial: room.tutorial,
          },
        });
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
    {
      room.outputClients.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageString);
        }
      });
      room.inputClients.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageString);
        }
      });
      const roomSubscribers = connectionsState.subscribers.get(roomName);
      roomSubscribers?.forEach((subscriber) => {
        if (subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(messageString);
        }
      });
    }
  }
}

function getBeatTimes(beat: NonNullable<Room["beat"]>): {
  lastBeatNumber: number;
  nextBeatTimestamp: number;
} {
  const now = performance.now() + performance.timeOrigin;
  const beatInterval = (60 / beat.currentBpm) * 1000;
  const timeSinceLastBeat = now - beat.lastSyncedBeatTimestamp;
  const beatsSinceLastSync = Math.floor(timeSinceLastBeat / beatInterval);
  const lastBeatNumber = beat.lastSyncedBeatNumber + beatsSinceLastSync;
  const nextBeatTimestamp =
    beat.lastSyncedBeatTimestamp + (beatsSinceLastSync + 1) * beatInterval;
  return { lastBeatNumber, nextBeatTimestamp };
}
