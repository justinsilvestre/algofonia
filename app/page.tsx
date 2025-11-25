"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebsocket } from "./listen/useWebsocket";
import { MessageToClient, RoomState } from "./WebsocketMessage";
import { startBeats } from "./listen/startBeats";
import { useServerTimeSync } from "./listen/useServerTimeSync";
import { getOrientationControlFromEvent } from "./movement-test/getOrientationControlFromEvent";

const DEFAULT_ROOM_NAME = "default";

export default function InputClientPage() {
  const [debug] = useState<boolean>(false);
  const [debugText, setDebugText] = useState<string>("");

  const [showMonitor, setShowMonitor] = useState(false);
  const [orientationControl, setOrientationControl] = useState<{
    /** right-way up = 100, upside down = 0 */
    frontToBack: number;
    around: number;
  }>({
    frontToBack: 100,
    around: 100,
  });

  const [userId, setUserId] = useState<number>(0);
  const [bpm, setBpm] = useState<number | null>(null);

  const nextBeatTimestampRef = useRef<number | null>(null);
  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();
  const [roomState, setRoomState] = useState<RoomState>({
    inputClientsCount: 0,
    outputClientsCount: 0,
  });

  const movement = useMovement();

  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: (message: MessageToClient) => {
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
              const flashContainer = document.getElementById("flash-container");
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
      }
    },
  });

  useEffect(() => {
    if (connectionState.type === "connected") {
      console.log("Sending JOIN_ROOM_REQUEST");
      sendMessage({
        type: "JOIN_ROOM_REQUEST",
        roomName: DEFAULT_ROOM_NAME,
        clientType: "input",
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

  useEffect(() => {
    const handleDeviceOrientationEvent = (event: DeviceOrientationEvent) => {
      console.log(
        event.absolute ? "Absolute" : "Non-absolute",
        "orientation event"
      );
      if (event.alpha === null || event.beta === null) {
        console.warn("DeviceOrientationEvent missing alpha or beta");
        setDebugText("DeviceOrientationEvent missing alpha or beta");
        return;
      } else {
        const orientation = getOrientationControlFromEvent(
          event.alpha,
          event.beta
        );
        setOrientationControl(orientation);
        const now = performance.now() + performance.timeOrigin;
        if (
          orientation.frontToBack !== orientationControl.frontToBack ||
          orientation.around !== orientationControl.around
        )
          sendMessage({
            type: "MOTION_INPUT",
            roomName: DEFAULT_ROOM_NAME,
            userId,
            frontToBack: orientation.frontToBack,
            around: orientation.around,
            actionTimestamp: now,
            nextBeatTimestamp: nextBeatTimestampRef.current ?? now,
          });
      }
    };
    window.addEventListener("deviceorientation", handleDeviceOrientationEvent);
    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientationEvent
      );
    };
  }, [
    orientationControl.around,
    orientationControl.frontToBack,
    sendMessage,
    userId,
  ]);

  const start = () => {
    console.log("Movement permission requested");
    movement
      .requestPermission()
      .then(() => {
        console.log("Movement permission granted");
      })
      .catch((err) => {
        console.error("Error requesting movement permission:", err);
        setDebugText("Error requesting movement permission: " + err);
      });
  };
  if (!movement.state.hasPermission) {
    return (
      <div
        className="w-screen h-screen bg-black text-center flex flex-col items-center justify-center"
        onClick={start}
      >
        <button className="text-white">tap to start</button>
      </div>
    );
  }

  if (connectionState.type !== "connected") {
    return (
      <>
        <h1>input client</h1>
        <p>Connection status: {connectionState.type}</p>
        {connectionState.type === "error" && (
          <p>Error message: {connectionState.message}</p>
        )}
      </>
    );
  }

  const blue = Math.max(
    0,
    Math.min(255, Math.round((orientationControl.frontToBack / 100) * 255))
  );
  const green = Math.max(
    0,
    Math.min(255, Math.round((orientationControl.around / 100) * 255))
  );

  return (
    <div
      id="container"
      className="w-screen h-screen text-white bg-black"
      style={{ backgroundColor: `rgb(0, ${green}, ${blue})` }}
    >
      <div id="flash-container" className="w-screen h-screen p-4">
        <div className="text-right">
          <button
            className="bg-black  text-white px-3 py-2 rounded-lg  m-4"
            onClick={() => setShowMonitor(!showMonitor)}
          >
            {showMonitor ? "Hide" : "Show"} Monitor
          </button>
        </div>

        <h1>input client</h1>

        <p>{roomState.inputClientsCount} input clients connected</p>
        <p>{roomState.outputClientsCount} output clients connected</p>

        {debugText && debug ? <p>{debugText}</p> : null}
      </div>
    </div>
  );
}

type MovementState = {
  hasPermission: boolean | null;
};
function useMovement() {
  const [state, setState] = useState<MovementState>({
    hasPermission: null,
  });
  const requestPermission = useCallback(async () => {
    // Feature-detect the old “DeviceMotionEvent.requestPermission” API (iOS)
    if (
      window.DeviceMotionEvent &&
      typeof (
        window.DeviceMotionEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const response = await (
          window.DeviceMotionEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (response === "granted") {
          setState((prev) => ({ ...prev, hasPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device motion permission:", err);
        setState((prev) => ({ ...prev, hasPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasPermission: true }));
    }
  }, []);

  return { requestPermission, state };
}
