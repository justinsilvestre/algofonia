"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageToClient,
  MessageToServer,
  RoomState,
} from "../WebsocketMessage";
import { useWebsocket } from "../useWebsocket";
import { useServerTimeSync } from "./useServerTimeSync";
import { startBeats } from "./startBeats";
import { useTone } from "./useTone";
import { getRoomName } from "../getRoomName";
import { channels } from "./channels";

type InputClientState = {
  userId: number;
  frontToBack: number;
  around: number;
};

const VERBOSE_LOGGING = false;

export default function OutputClientPage() {
  const [debug] = useState<boolean>(false);
  const [debugText, setDebugText] = useState<string>("");

  const [userId, setUserId] = useState<number | null>(null);
  const [inputClients, setInputClients] = useState<
    Map<number, InputClientState>
  >(new Map());

  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();

  const nextBeatTimestampRef = useRef<number | null>(null);
  const tone = useTone(120, nextBeatTimestampRef, offsetFromServerTimeRef);
  const {
    controls: toneControls,
    musicState,
    input: inputToTone,
    setBpm,
  } = tone;
  const getBpm = useCallback(() => {
    return toneControls ? toneControls.getBpm() : 120;
  }, [toneControls]);

  const beatsCountRef = useRef<number>(0);

  const [roomState, setRoomState] = useState<RoomState>({
    inputClients: [],
    outputClients: [],
    subscriptionsCount: 0,
  });
  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (
        message: MessageToClient,
        sendMessage: (message: MessageToServer) => void
      ) => {
        if (VERBOSE_LOGGING)
          console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY":
            const { userId } = message;
            beatsCountRef.current = message.lastBeatNumber;
            nextBeatTimestampRef.current = message.nextBeatTimestamp;
            setUserId(message.userId);
            setRoomState(message.roomState);
            const roomName = getRoomName();

            setBpm(message.bpm);
            startBeats(
              message.nextBeatTimestamp,
              getBpm,
              beatsCountRef,
              nextBeatTimestampRef,
              offsetFromServerTimeRef,
              () => {
                if (VERBOSE_LOGGING)
                  console.log("BEAT #" + beatsCountRef.current);
                sendMessage({
                  type: "SCHEDULE_BEAT",
                  roomName,
                  beatNumber: beatsCountRef.current + 1,
                  beatTimestamp: nextBeatTimestampRef.current!,
                });

                const outputClients = message.roomState.outputClients;
                const isFirstOutputClient = outputClients[0] === userId;
                if (isFirstOutputClient && beatsCountRef.current % 20 === 0) {
                  sendMessage({
                    type: "SYNC_BEAT",
                    roomName,
                    beatNumber: beatsCountRef.current + 1,
                    beatTimestamp: nextBeatTimestampRef.current!,
                  });
                }

                const flashContainer =
                  document.getElementById("flash-container");
                // Flash white
                const flashDuration = 100; // Duration of the white flash in milliseconds
                if (flashContainer)
                  flashContainer.style.backgroundColor = "white";
                // Reset background after flash duration
                setTimeout(() => {
                  const flashContainer =
                    document.getElementById("flash-container");
                  if (flashContainer) flashContainer.style.backgroundColor = "";
                }, flashDuration);
              }
            );
            break;
          case "ROOM_STATE_UPDATE":
            setRoomState(message.roomState);
            // Remove disconnected input clients
            setInputClients((prev) => {
              const newMap = new Map();
              message.roomState.inputClients.forEach((clientId) => {
                if (prev.has(clientId)) {
                  newMap.set(clientId, prev.get(clientId)!);
                }
              });
              return newMap;
            });
            break;
          case "SYNC_REPLY": {
            const { t0, s0 } = message;
            const t1 = performance.now() + performance.timeOrigin;
            processSyncReply({ t0, s0, t1 });
            break;
          }
          case "MOTION_INPUT": {
            if (!toneControls) {
              console.warn("No tone controls available for MOTION_INPUT");
              setDebugText("No tone controls available for MOTION_INPUT");
              break;
            }

            const { userId: inputUserId, frontToBack, around } = message;
            const userIdsToChannelKeys = getUserIdsToChannelKeys(
              roomState.inputClients
            );
            const channelKey = userIdsToChannelKeys.get(inputUserId)!;
            inputToTone(channelKey, message);

            // Update the specific input client's state
            setInputClients((prev) => {
              const newMap = new Map(prev);
              newMap.set(inputUserId, {
                userId: inputUserId,
                frontToBack,
                around,
              });
              return newMap;
            });

            break;
          }
          case "SET_TEMPO": {
            // placeholder
            break;
          }
        }
      },
      [
        offsetFromServerTimeRef,
        processSyncReply,
        toneControls,
        inputToTone,
        setBpm,
        getBpm,
        roomState.inputClients,
      ]
    ),
  });

  useEffect(() => {
    if (connectionState.type === "connected") {
      console.log("Sending JOIN_ROOM_REQUEST");
      sendMessage({
        type: "JOIN_ROOM_REQUEST",
        roomName: getRoomName(),
        clientType: "output",
      });

      const syncInterval = setInterval(() => {
        sendMessage({
          type: "SYNC",
          t0: performance.now() + performance.timeOrigin,
        });
        syncRequestsCountRef.current += 1;
        if (syncRequestsCountRef.current >= 30) {
          clearInterval(syncInterval);
        }
      }, 10);
      return () => clearInterval(syncInterval);
    }
  }, [connectionState.type, sendMessage, syncRequestsCountRef]);
  if (connectionState.type !== "connected") {
    return (
      <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Listen</h1>
          <div className="space-y-2">
            <p className="text-xl">
              Connection status:
              <span
                className={`ml-2 font-semibold ${
                  connectionState.type === "connecting"
                    ? "text-yellow-400"
                    : connectionState.type === "error"
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                {connectionState.type}
              </span>
            </p>
            {connectionState.type === "error" && (
              <p className="text-red-400 bg-red-900/20 border border-red-400/30 rounded-lg p-4 max-w-md">
                Error: {connectionState.message}
              </p>
            )}
            {connectionState.type === "connecting" && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="text-gray-300">Connecting...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const userIdsToChannelKeys = getUserIdsToChannelKeys(roomState.inputClients);
  console.log("userIdsToChannelKeys:", userIdsToChannelKeys);

  return (
    <div id="container" className="w-screen h-screen text-white bg-black">
      <div id="flash-container" className="w-screen h-screen p-4">
        <h1>Listen</h1>
        <p>Room name: {getRoomName()}</p>
        <p>
          Your user ID: {userId}{" "}
          {roomState.outputClients[0] === userId ? "(tempo source)" : ""}
        </p>
        {debug && <p>{debugText}</p>}

        <p>{roomState.inputClients.length} input clients connected</p>
        <p>{roomState.outputClients.length} output clients connected</p>
        <p>{roomState.subscriptionsCount} subscribers</p>
        {musicState && <p>{musicState.bpm} BPM</p>}
        {!toneControls && (
          <button className="text-white p-8" onClick={tone.start}>
            click to start
          </button>
        )}

        {/* Individual Input Client Displays */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {toneControls &&
            channels
              .flatMap((channel, i) => {
                const userIdsForChannel = Array.from(
                  userIdsToChannelKeys.entries()
                )
                  .filter(([, channelKey]) => channelKey === channel.key)
                  .map(([userId]) => userId);
                return userIdsForChannel.length
                  ? userIdsForChannel.map(
                      (userId) => [userId, channel] as [number, typeof channel]
                    )
                  : [[-i, channel] as [number, typeof channel]];
              })
              .map(([userId, channel]) => {
                const { key: channelKey } = channel;
                const client = inputClients.get(userId) || {
                  userId,
                  frontToBack: 0,
                  around: 0,
                };

                const blue =
                  Math.max(
                    0,
                    Math.min(255, Math.round((client.frontToBack / 100) * 255))
                  ) * 0.7;
                const green =
                  Math.max(
                    0,
                    Math.min(255, Math.round((client.around / 100) * 255))
                  ) * 0.7;

                return (
                  <div
                    key={userId}
                    className="p-4 rounded-lg border-2 border-white/20"
                    style={{ backgroundColor: `rgb(0, ${green}, ${blue})` }}
                  >
                    <div className="text-sm font-mono mb-2">
                      {channelKey} {userId <= 0 ? "" : <>(user ID #{userId})</>}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-black/30 p-2">
                        <label className="block text-xs mb-1">
                          Front-to-back: {Math.round(client.frontToBack)}{" "}
                          (manual override)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={client.frontToBack}
                          onChange={(e) => {
                            const newFrontToBack = parseInt(e.target.value);
                            const newClient = {
                              ...client,
                              frontToBack: newFrontToBack,
                            };

                            // Update local state
                            setInputClients((prev) => {
                              const newMap = new Map(prev);
                              newMap.set(userId, newClient);
                              return newMap;
                            });

                            // Simulate motion input event
                            if (toneControls) {
                              const simulatedMotionInput = {
                                type: "MOTION_INPUT" as const,
                                roomName: getRoomName(),
                                userId,
                                frontToBack: newFrontToBack,
                                around: client.around,
                                actionTimestamp:
                                  performance.now() + performance.timeOrigin,
                                lastBeatNumber: beatsCountRef.current,
                                nextBeatTimestamp:
                                  nextBeatTimestampRef.current ??
                                  performance.now() + performance.timeOrigin,
                              };
                              inputToTone(channelKey, simulatedMotionInput);
                            }
                          }}
                          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #0066cc 0%, #0066cc ${client.frontToBack}%, rgba(255,255,255,0.2) ${client.frontToBack}%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                      </div>

                      <div className="rounded-lg bg-black/30 p-2">
                        <label className="block text-xs mb-1">
                          Around: {Math.round(client.around)} (manual override)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={client.around}
                          onChange={(e) => {
                            const newAround = parseInt(e.target.value);
                            const newClient = { ...client, around: newAround };

                            // Update local state
                            setInputClients((prev) => {
                              const newMap = new Map(prev);
                              newMap.set(userId, newClient);
                              return newMap;
                            });

                            // Simulate motion input event
                            if (toneControls) {
                              const simulatedMotionInput = {
                                type: "MOTION_INPUT" as const,
                                roomName: getRoomName(),
                                userId,
                                frontToBack: client.frontToBack,
                                around: newAround,
                                actionTimestamp:
                                  performance.now() + performance.timeOrigin,
                                lastBeatNumber: beatsCountRef.current,
                                nextBeatTimestamp:
                                  nextBeatTimestampRef.current ??
                                  performance.now() + performance.timeOrigin,
                              };
                              inputToTone(channelKey, simulatedMotionInput);
                            }
                          }}
                          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #00cc66 0%, #00cc66 ${client.around}%, rgba(255,255,255,0.2) ${client.around}%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
function getUserIdsToChannelKeys(inputClients: number[]) {
  const userIdsToChannelKeys = new Map<number, string>();
  for (let i = 0; i < inputClients.length; i++) {
    const userId = inputClients[i];
    const channelKey = channels[i % channels.length].key;
    userIdsToChannelKeys.set(userId, channelKey);
  }
  return userIdsToChannelKeys;
}
