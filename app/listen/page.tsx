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

type InputClientState = {
  userId: number;
  frontToBack: number;
  around: number;
};

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
  const tone = useTone();
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
  });
  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (
        message: MessageToClient,
        sendMessage: (message: MessageToServer) => void
      ) => {
        console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY":
            const { userId } = message;
            beatsCountRef.current = message.lastBeatNumber;
            nextBeatTimestampRef.current = message.nextBeatTimestamp;
            setUserId(message.userId);
            setRoomState(message.roomState);

            setBpm(message.bpm);
            startBeats(
              message.nextBeatTimestamp,
              getBpm,
              beatsCountRef,
              nextBeatTimestampRef,
              offsetFromServerTimeRef,
              () => {
                console.log("BEAT #" + beatsCountRef.current);
                const outputClients = message.roomState.outputClients;
                const isFirstOutputClient = outputClients[0] === userId;
                if (isFirstOutputClient && beatsCountRef.current % 20 === 0) {
                  sendMessage({
                    type: "SYNC_BEAT",
                    roomName: getRoomName(),
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
            if (toneControls) {
              inputToTone("drone chord", message);
              inputToTone("arpeggio", message);
            }

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
      <>
        <h1>Listen</h1>
        <p>Connection status: {connectionState.type}</p>
        {connectionState.type === "error" && (
          <p>Error message: {connectionState.message}</p>
        )}
      </>
    );
  }

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
        {musicState && <p>{musicState.bpm} BPM</p>}
        {!toneControls && (
          <button className="text-white p-8" onClick={tone.start}>
            tap to start
          </button>
        )}

        {/* Individual Input Client Displays */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(inputClients.values()).map((client) => {
            const blue = Math.max(
              0,
              Math.min(255, Math.round((client.frontToBack / 100) * 255))
            );
            const green = Math.max(
              0,
              Math.min(255, Math.round((client.around / 100) * 255))
            );

            return (
              <div
                key={client.userId}
                className="p-4 rounded-lg border-2 border-white/20"
                style={{ backgroundColor: `rgb(0, ${green}, ${blue})` }}
              >
                <div className="text-sm font-mono mb-2">
                  Client #{client.userId}
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-black/30 p-2">
                    <label className="block text-xs mb-1">
                      Front-to-back: {Math.round(client.frontToBack)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={client.frontToBack}
                      readOnly
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-default slider"
                      style={{
                        background: `linear-gradient(to right, #0066cc 0%, #0066cc ${client.frontToBack}%, rgba(255,255,255,0.2) ${client.frontToBack}%, rgba(255,255,255,0.2) 100%)`,
                      }}
                    />
                  </div>

                  <div className="rounded-lg bg-black/30 p-2">
                    <label className="block text-xs mb-1">
                      Around: {Math.round(client.around)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={client.around}
                      readOnly
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-default slider"
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
