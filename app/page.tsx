"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebsocket } from "./useWebsocket";
import { MessageToClient, RoomState } from "./WebsocketMessage";
import { startBeats } from "./listen/startBeats";
import { useServerTimeSync } from "./listen/useServerTimeSync";
import { getOrientationControlFromEvent } from "./movement-test/getOrientationControlFromEvent";
import { getRoomName } from "./getRoomName";

export default function InputClientPage() {
  const [debug] = useState<boolean>(false);
  const [debugText, setDebugText] = useState<string>("");
  const controlsOverrideStateRef = useRef<{
    frontToBack: boolean;
    around: boolean;
    alpha: boolean;
    beta: boolean;
    gamma: boolean;
  }>({
    frontToBack: false,
    around: false,
    alpha: false,
    beta: false,
    gamma: false,
  });

  const [showMonitor, setShowMonitor] = useState(false);
  const [orientationControl, setOrientationControl] = useState<{
    /** right-way up = 100, upside down = 0 */
    frontToBack: number;
    around: number;
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({
    frontToBack: 100,
    around: 100,
    alpha: null,
    beta: null,
    gamma: null,
  });

  const [userId, setUserId] = useState<number>(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const getBpm = useCallback((): number => {
    return bpm ?? 120;
  }, [bpm]);

  const beatsCountRef = useRef<number>(0);
  const nextBeatTimestampRef = useRef<number | null>(null);
  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();
  const [roomState, setRoomState] = useState<RoomState>({
    inputClients: [],
    outputClients: [],
    subscriptionsCount: 0,
  });

  const movement = useMovement();

  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (message: MessageToClient) => {
        console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY":
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
          case "SYNC_BEAT": {
            nextBeatTimestampRef.current = message.beatTimestamp;
            beatsCountRef.current = message.beatNumber - 1; // will be incremented on next beat
            break;
          }
        }
      },
      [offsetFromServerTimeRef, getBpm, processSyncReply]
    ),
  });

  const lastSentOrientationRef = useRef<{
    frontToBack: number;
    around: number;
  }>({
    frontToBack: orientationControl.frontToBack,
    around: orientationControl.around,
  });

  useEffect(() => {
    const roomName = getRoomName();

    if (connectionState.type === "connected") {
      console.log("Sending JOIN_ROOM_REQUEST");
      sendMessage({
        type: "JOIN_ROOM_REQUEST",
        roomName,
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
    console.log("Setting up deviceorientation event listener");
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

        // Only update orientation if manual controls are not being used
        const newOrientation = {
          frontToBack: controlsOverrideStateRef.current.frontToBack
            ? lastSentOrientationRef.current.frontToBack
            : orientation.frontToBack,
          around: controlsOverrideStateRef.current.around
            ? lastSentOrientationRef.current.around
            : orientation.around,
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma,
        };

        setOrientationControl(newOrientation);

        // Only send motion input if neither control is being manually overridden
        if (
          !controlsOverrideStateRef.current.frontToBack &&
          !controlsOverrideStateRef.current.around
        ) {
          const now = performance.now() + performance.timeOrigin;
          if (
            newOrientation.frontToBack !==
              lastSentOrientationRef.current.frontToBack ||
            newOrientation.around !== lastSentOrientationRef.current.around
          ) {
            sendMessage({
              type: "MOTION_INPUT",
              roomName: getRoomName(),
              userId,
              frontToBack: newOrientation.frontToBack,
              around: newOrientation.around,
              actionTimestamp: now,
              lastBeatNumber: beatsCountRef.current,
              nextBeatTimestamp: nextBeatTimestampRef.current ?? now,
            });
            lastSentOrientationRef.current = {
              frontToBack: newOrientation.frontToBack,
              around: newOrientation.around,
            };
          }
        }
      }
    };
    window.addEventListener("deviceorientation", handleDeviceOrientationEvent);
    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientationEvent
      );
    };
  }, [sendMessage, userId]);

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
        <button className="text-white">
          1. lock your device
          <br />
          in <strong>portrait mode</strong>
          <br />
          <br />
          2. tap to start
        </button>
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

  // Calculate orb position based on frontToBack, keeping it within screen bounds
  // Map 0-100 to the available screen height minus orb radius (32px = half of w-16)
  const orbRadius = 32; // Half of 64px (w-16 h-16)
  const orbYPercent = Math.max(
    0,
    Math.min(100, orientationControl.frontToBack)
  );
  const orbYPixels =
    (orbYPercent / 100) * (window.innerHeight - 2 * orbRadius) + orbRadius;

  // Calculate orb color based on around value
  const green = Math.max(
    0,
    Math.min(255, Math.round((orientationControl.around / 100) * 255))
  );

  return (
    <div
      id="container"
      className="w-full h-full text-white bg-black relative overflow-hidden"
    >
      {/* Gravity Orb */}
      <div
        className="absolute w-16 h-16 rounded-full shadow-lg transition-all duration-100 ease-out"
        style={{
          backgroundColor: `rgb(255, ${green}, 100)`,
          boxShadow: `0 0 20px rgb(255, ${green}, 100)`,
          left: "50%",
          top: `${orbYPixels}px`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div id="flash-container" className="w-screen h-screen p-4 relative z-10">
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
              <div className="mb-2 text-sm">
                Room name: {getRoomName()} | Your user ID: {userId} | BPM: {bpm}
              </div>
              <div className="mb-1 rounded-lg bg-black/50 p-1">
                <div className="text-xs">Alpha (compass direction 0-360)</div>
                <div className="text-lg bg-black/50 p-1 font-mono">
                  {toNearestHundredth(orientationControl.alpha)}
                </div>
              </div>
              <div className="mb-1 rounded-lg bg-black/50 p-1">
                <div className="text-xs">
                  Beta/X rotation (0 = on back, 90 = upright, 180 = facing down,
                  -90 = upside down)
                </div>
                <div className="text-lg bg-black/50 p-1 font-mono">
                  {toNearestHundredth(orientationControl.beta)}
                </div>
                <div className="mb-1 rounded-lg bg-black/50 p-1">
                  <div className="text-xs">
                    Gamma/Y rotation (-90 = left side down, 0 = flat, 90 = right
                    side down)
                  </div>
                  <div className="text-lg bg-black/50 p-1 font-mono">
                    {toNearestHundredth(orientationControl.gamma)}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="text-sm text-white/80">
                  Processed orientation values (slide to override):
                </div>

                <div className="rounded-lg bg-black/50 p-2">
                  <label className="block text-xs mb-1">
                    Front-to-back: {Math.round(orientationControl.frontToBack)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={orientationControl.frontToBack}
                    onMouseDown={() => {
                      controlsOverrideStateRef.current.frontToBack = true;
                    }}
                    onMouseUp={() => {
                      controlsOverrideStateRef.current.frontToBack = false;
                    }}
                    onTouchStart={() => {
                      controlsOverrideStateRef.current.frontToBack = true;
                    }}
                    onTouchEnd={() => {
                      controlsOverrideStateRef.current.frontToBack = false;
                    }}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      const newOrientation = {
                        ...orientationControl,
                        frontToBack: newValue,
                      };
                      setOrientationControl(newOrientation);
                      const now = performance.now() + performance.timeOrigin;
                      sendMessage({
                        type: "MOTION_INPUT",
                        roomName: getRoomName(),
                        userId,
                        frontToBack: newValue,
                        around: orientationControl.around,
                        actionTimestamp: now,
                        lastBeatNumber: beatsCountRef.current,
                        nextBeatTimestamp: nextBeatTimestampRef.current ?? now,
                      });
                    }}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div className="rounded-lg bg-black/50 p-2">
                  <label className="block text-xs mb-1">
                    Around: {Math.round(orientationControl.around)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={orientationControl.around}
                    onMouseDown={() => {
                      controlsOverrideStateRef.current.around = true;
                    }}
                    onMouseUp={() => {
                      controlsOverrideStateRef.current.around = false;
                    }}
                    onTouchStart={() => {
                      controlsOverrideStateRef.current.around = true;
                    }}
                    onTouchEnd={() => {
                      controlsOverrideStateRef.current.around = false;
                    }}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      const newOrientation = {
                        ...orientationControl,
                        around: newValue,
                      };
                      setOrientationControl(newOrientation);
                      const now = performance.now() + performance.timeOrigin;
                      sendMessage({
                        type: "MOTION_INPUT",
                        roomName: getRoomName(),
                        userId,
                        frontToBack: orientationControl.frontToBack,
                        around: newValue,
                        actionTimestamp: now,
                        lastBeatNumber: beatsCountRef.current,
                        nextBeatTimestamp: nextBeatTimestampRef.current ?? now,
                      });
                    }}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
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

function toNearestHundredth(value: number | null) {
  if (value === null) return "null";
  return Math.round(value * 100) / 100;
}
