"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebsocket } from "./useWebsocket";
import { MessageToClient, RoomState } from "./WebsocketMessage";
import { startBeats } from "./listen/startBeats";
import { useServerTimeSync } from "./listen/useServerTimeSync";
import { getOrientationControlFromEvent } from "./movement-test/getOrientationControlFromEvent";

const DEFAULT_ROOM_NAME = "default";

//   const [sensor, setSensor] = useState<AbsoluteOrientationSensor | null>(null);

//   useEffect(() => {
//     const sensor = new AbsoluteOrientationSensor({
//       frequency: 60,
//       referenceFrame: "device",
//     });

//     const handleReading = () => {
//       console.log("Orientation quaternion:", sensor.quaternion);
//       // setDebugText(
//       //   `Orientation quaternion: ${sensor.quaternion
//       //     // round to 2 decimal places
//       //     .map((v) => Math.round(v * 100) / 100)
//       //     .join("\n")}`
//       // );
//       const [w, x, y, z] = sensor.quaternion;
//       const ysqr = y * y;

//       // roll (x-axis)
//       const t0 = +2.0 * (w * x + y * z);
//       const t1 = +1.0 - 2.0 * (x * x + ysqr);
//       const roll = Math.atan2(t0, t1);

//       // pitch (y-axis)
//       let t2 = +2.0 * (w * y - z * x);
//       t2 = Math.min(1.0, Math.max(-1.0, t2));
//       const pitch = Math.asin(t2);

//       // yaw (z-axis) — rotation around screen normal
//       const t3 = +2.0 * (w * z + x * y);
//       const t4 = +1.0 - 2.0 * (ysqr + z * z);
//       const yaw = Math.atan2(t3, t4);

//       const radiansToDegreesRounded = (radians: number) => {
//         const degrees = radians * (180 / Math.PI);
//         return Math.round(degrees * 1) / 1;
//       };

//       setDebugText(`roll: ${radiansToDegreesRounded(roll)}
// pitch: ${radiansToDegreesRounded(pitch)}
// yaw: ${radiansToDegreesRounded(yaw)}`);
//     };
//     const handleError = (event: Event) => {
//       if (
//         "error" in event &&
//         event.error &&
//         (event.error as Error).name === "NotReadableError"
//       ) {
//         console.log("Sensor is not available.");
//       }
//       console.error("Sensor error:", event);
//     };

//     sensor.addEventListener("reading", handleReading);
//     sensor.addEventListener("error", handleError);

//     sensor.start();

//     // eslint-disable-next-line react-hooks/set-state-in-effect
//     setSensor(sensor);
//     return () => {
//       sensor.removeEventListener("reading", handleReading);
//       sensor.removeEventListener("error", handleError);
//       sensor.stop();
//     };
//   }, [setSensor]);
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

        {showMonitor && (
          <div>
            <div className=" text-white p-4 rounded-lg">
              {debug ? <p className="mb-2">{debugText}</p> : null}
              <div className="mb-1 rounded-lg bg-black/50 p-1">
                <div className="text-xs">Front-to-back</div>
                <div className="text-lg bg-black/50 p-1 font-mono">
                  {Math.round(orientationControl.frontToBack)}
                </div>
              </div>
              <div className="mb-1 rounded-lg bg-black/50 p-1">
                <div className="text-xs">Around</div>
                <div className="text-lg bg-black/50 p-1 font-mono">
                  {Math.round(orientationControl.around)}
                </div>
              </div>
            </div>
          </div>
        )}

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
