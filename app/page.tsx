"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebsocket } from "./useWebsocket";
import { MessageToClient, RoomState } from "./WebsocketMessage";
import { useBeatsListener } from "./listen/useBeatsListener";
import { useServerTimeSync } from "./listen/useServerTimeSync";
import { getOrientationControlFromEvent } from "./movement-test/getOrientationControlFromEvent";
import { getRoomName } from "./getRoomName";
import { useCanvas, MotionVisuals } from "./MotionVisuals";
import { useWakeLock } from "react-screen-wake-lock";

const SHOW_DEBUG_TEXT = true;

export default function InputClientPage() {
  const wakeLock = useWakeLock({
    reacquireOnPageVisible: true,
  });
  const releaseWakeLock = wakeLock.release;
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const [debug] = useState<boolean>(SHOW_DEBUG_TEXT);
  const [debugText, setDebugText] = useState<string>("");
  const [visualsAreShowing, setVisualsAreShowing] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const enableVisualsParam = params.get("enable_visuals");
      if (!enableVisualsParam) return true;
      console.log("enable_visuals param:", enableVisualsParam);
      console.log("!enableVisualsParam", !enableVisualsParam);
      console.log(
        "enableVisualsParam === '0' || enableVisualsParam === 'false'",
        enableVisualsParam === "0" || enableVisualsParam === "false"
      );
      if (enableVisualsParam === "0" || enableVisualsParam === "false")
        return false;
      return true;
    }
    return true;
  });
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
    return bpm ?? 100;
  }, [bpm]);

  const beatsCountRef = useRef<number>(0);
  const nextBeatTimestampRef = useRef<number | null>(null);
  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();
  const [roomState, setRoomState] = useState<RoomState>({
    inputClients: [],
    outputClients: [],
    subscriptionsCount: 0,
    beat: null,
  });

  const movement = useMovement();

  const lastSentOrientationRef = useRef<{
    frontToBack: number;
    around: number;
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({
    frontToBack: orientationControl.frontToBack,
    around: orientationControl.around,
    alpha: orientationControl.alpha,
    beta: orientationControl.beta,
    gamma: orientationControl.gamma,
  });

  const canvas = useCanvas(lastSentOrientationRef);
  const { pulse } = canvas;

  const [beatsStartTimestamp, setBeatsStartTimestamp] = useState<number | null>(
    null
  );

  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (message: MessageToClient) => {
        console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY": {
            const { beat } = message.roomState;
            if (!beat) {
              setUserId(message.userId);
              setRoomState(message.roomState);
              break;
            }

            const { lastBeatNumber, nextBeatTimestamp, bpm } = beat;

            beatsCountRef.current = lastBeatNumber;
            nextBeatTimestampRef.current = nextBeatTimestamp;
            if (nextBeatTimestampRef.current === undefined) {
              throw new Error("nextBeatTimestamp is undefined");
            }
            setUserId(message.userId);
            setRoomState(message.roomState);

            setBpm(bpm);
            setBeatsStartTimestamp(nextBeatTimestamp);
            break;
          }
          case "ROOM_STATE_UPDATE":
            setRoomState(message.roomState);
            const { beat } = message.roomState;
            if (beat) {
              beatsCountRef.current = beat.lastBeatNumber - 1;
              nextBeatTimestampRef.current = beat.nextBeatTimestamp;
              if (nextBeatTimestampRef.current === undefined) {
                throw new Error("nextBeatTimestamp is undefined");
              }
              setBpm(beat.bpm);
              setBeatsStartTimestamp(
                (startTimestamp) => startTimestamp ?? beat.nextBeatTimestamp
              );
            }
            break;
          case "SYNC_REPLY": {
            const { t0, s0 } = message;
            const t1 = performance.now() + performance.timeOrigin;
            processSyncReply({ t0, s0, t1 });
            break;
          }
          case "SYNC_BEAT": {
            setBpm(message.bpm);

            break;
          }
        }
      },
      [processSyncReply]
    ),
  });

  useBeatsListener(
    beatsStartTimestamp,
    getBpm,
    beatsCountRef,
    nextBeatTimestampRef,
    offsetFromServerTimeRef,
    useCallback(
      (n) => {
        console.log("BEAT #" + beatsCountRef.current);

        // Trigger orb beat pulse
        pulse();
      },
      [pulse]
    )
  );

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
      if (event.alpha === null) {
        console.warn("DeviceOrientationEvent missing alpha");
        setDebugText("DeviceOrientationEvent missing alpha");
        return;
      }
      if (event.beta === null) {
        console.warn("DeviceOrientationEvent missing beta");
        setDebugText("DeviceOrientationEvent missing beta");
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
              alpha: newOrientation.alpha,
              beta: newOrientation.beta,
              gamma: newOrientation.gamma,
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

    wakeLock.request().catch((err) => {
      console.error("Error requesting wake lock:", err);
      setDebugText("Error requesting wake lock: " + err);
    });
  };
  if (!movement.state.hasMotionPermission) {
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
      <div className="w-screen h-dvh bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4"></div>
        <h1 className="text-2xl font-bold">Input Client</h1>
        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-lg mb-2">
            You&apos;ve been disconnected. Refresh the page to reconnect.
          </p>
          {connectionState.type === "error" && (
            <p className="text-red-400 text-sm">
              Error: {connectionState.message}
            </p>
          )}
          {connectionState.type === "connecting" && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm">Connecting...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id="container"
      className="w-full h-dvh text-white bg-black relative overflow-hidden"
    >
      {visualsAreShowing ? (
        <MotionVisuals canvas={canvas} key={String(visualsAreShowing)} />
      ) : null}
      <div className="w-screen h-screen p-4 relative z-10">
        <div className="text-right">
          <button
            className="bg-black  text-white px-3 py-2 rounded-lg  m-4"
            onClick={() => setShowMonitor(!showMonitor)}
          >
            {showMonitor ? "Hide Monitor" : "Show Monitor"}
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
                      lastSentOrientationRef.current = newOrientation;
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
                      lastSentOrientationRef.current = newOrientation;
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

            <div className="mb-4 text-right">
              <button
                className="bg-white/10 text-white px-3 py-2 rounded-lg"
                onClick={() => setVisualsAreShowing(!visualsAreShowing)}
              >
                {visualsAreShowing ? "Hide Visuals" : "Show Visuals"}
              </button>
            </div>
          </div>
        )}

        {debugText && debug ? <p>{debugText}</p> : null}
      </div>
    </div>
  );
}

type MovementState = {
  hasMotionPermission: boolean | null;
  hasOrientationPermission: boolean | null;
};
function useMovement() {
  const [state, setState] = useState<MovementState>({
    hasMotionPermission: null,
    hasOrientationPermission: null,
  });
  const requestMotionPermission = useCallback(async () => {
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
          setState((prev) => ({ ...prev, hasMotionPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasMotionPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device motion permission:", err);
        setState((prev) => ({ ...prev, hasMotionPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasMotionPermission: true }));
    }
  }, []);

  const requestOrientationPermission = useCallback(async () => {
    // Feature-detect the old “DeviceOrientationEvent.requestPermission” API (iOS)
    if (
      window.DeviceOrientationEvent &&
      typeof (
        window.DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const response = await (
          window.DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (response === "granted") {
          setState((prev) => ({ ...prev, hasOrientationPermission: true }));
        } else {
          setState((prev) => ({ ...prev, hasOrientationPermission: false }));
        }
      } catch (err) {
        console.error("Error requesting device orientation permission:", err);
        setState((prev) => ({ ...prev, hasOrientationPermission: false }));
      }
    } else {
      // Non-iOS or browsers where no explicit permission API needed
      setState((prev) => ({ ...prev, hasOrientationPermission: true }));
    }
  }, []);

  const requestPermission = useCallback(async () => {
    await requestMotionPermission();
    await requestOrientationPermission();
  }, [requestMotionPermission, requestOrientationPermission]);

  return { requestPermission, state };
}

function toNearestHundredth(value: number | null) {
  if (value === null) return "null";
  return Math.round(value * 100) / 100;
}
