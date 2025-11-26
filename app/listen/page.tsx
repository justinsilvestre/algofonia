"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageToClient, RoomState } from "../WebsocketMessage";
import { useWebsocket } from "../useWebsocket";
import { useServerTimeSync } from "./useServerTimeSync";
import { startBeats } from "./startBeats";
import { useToneController } from "./useTone";

const DEFAULT_ROOM_NAME = "default";
function getRoomName() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("room") || DEFAULT_ROOM_NAME;
}

export default function OutputClientPage() {
  const [debug] = useState<boolean>(false);
  const [debugText, setDebugText] = useState<string>("");

  const [userId, setUserId] = useState<number>(0);

  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();

  const nextBeatTimestampRef = useRef<number | null>(null);
  const tone = useToneController();
  const {
    controls: toneControls,
    musicState,
    start: startTone,
    input: inputToTone,
    setBpm,
  } = tone;

  const [roomState, setRoomState] = useState<RoomState>({
    inputClientsCount: 0,
    outputClientsCount: 0,
  });
  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (message: MessageToClient) => {
        console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY":
            nextBeatTimestampRef.current = message.nextBeatTimestamp;
            setUserId(message.userId);
            setRoomState(message.roomState);

            setBpm(message.bpm);
            startBeats(
              message.bpm,
              message.nextBeatTimestamp,
              offsetFromServerTimeRef,
              () => {
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

            const { frontToBack, around } = message;
            if (toneControls) inputToTone(message);

            const blue = Math.max(
              0,
              Math.min(255, Math.round((frontToBack / 100) * 255))
            );
            const green = Math.max(
              0,
              Math.min(255, Math.round((around / 100) * 255))
            );
            const container = document.getElementById("container");
            if (container) {
              container.style.backgroundColor = `rgb(0, ${green}, ${blue})`;
            }

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
        <p>Your user ID: {userId}</p>
        {debug && <p>{debugText}</p>}

        <p>{roomState.inputClientsCount} input clients connected</p>
        <p>{roomState.outputClientsCount} output clients connected</p>
        {musicState && <p>{musicState.bpm} BPM</p>}
        {!toneControls && (
          <button className="text-white p-8" onClick={startTone}>
            tap to start
          </button>
        )}
      </div>
    </div>
  );
}
