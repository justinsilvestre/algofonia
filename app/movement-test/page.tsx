"use client";

import { useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { getOrientationControlFromEvent } from "./getOrientationControlFromEvent";

type ToneController = ReturnType<typeof getToneController>;
export default function MovementTest() {
  const [debugText, setDebugText] = useState<string>("");

  const [orientationState, setOrientationState] = useState<{
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({
    alpha: null,
    beta: null,
    gamma: null,
  });
  const [orientationControl, setOrientationControl] = useState<{
    /** right-way up = 100, upside down = 0 */
    frontToBack: number;
    around: number;
  }>({
    frontToBack: 100,
    around: 100,
  });
  const [toneController, setToneController] = useState<ToneController | null>(
    null
  );

  useEffect(() => {
    const handleDeviceOrientationEvent = (event: DeviceOrientationEvent) => {
      console.log(
        event.absolute ? "Absolute" : "Non-absolute",
        "orientation event"
      );
      const alpha = event.alpha; // rotation around z (compass heading)
      const beta = event.beta; // rotation around x (pitch): -180 (facing down) to 180 (facing up)
      const gamma = event.gamma; // rotation around y (roll): -90 (left) to 90 (right)

      console.log(`Pitch (beta): ${beta}`);
      console.log(`Roll (gamma): ${gamma}`);
      setOrientationState({ alpha, beta, gamma });
      if (alpha !== null && beta !== null) {
        setOrientationControl(getOrientationControlFromEvent(alpha, beta));
      }

      if (toneController) {
        const { gain1, gain2 } = toneController;
        // Map frontToBack to gain1 (poly1)
        const orientationControl = getOrientationControlFromEvent(
          alpha || 0,
          beta || 0
        );
        const gainValue1 = orientationControl.frontToBack / 50;
        gain1.gain.rampTo(gainValue1);
        // Map around to gain2 (poly2)
        const gainValue2 = orientationControl.around / 50;
        gain2.gain.rampTo(gainValue2);
      } else {
        setDebugText("No toneController yet");
      }
    };

    window.addEventListener("deviceorientation", handleDeviceOrientationEvent);
    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientationEvent
      );
    };
  }, [toneController]);

  const movement = useMovement();
  const start = () => {
    movement.requestPermission().then(() => {
      console.log("Movement permission requested");

      Tone.start().then(() => {
        console.log("Tone AudioContext started");

        const controller = getToneController(() => {
          const notes2 = ["G4", "A4", "D5", "F5"];
          const sixteenthNoteMs = Tone.Time("16n").toMilliseconds();

          controller.poly2.triggerAttackRelease(notes2[0], "16n");
          setTimeout(() => {
            controller.poly2.triggerAttackRelease(notes2[1], "16n");
          }, sixteenthNoteMs);
          setTimeout(() => {
            controller.poly2.triggerAttackRelease(notes2[2], "16n");
          }, sixteenthNoteMs * 2);
          setTimeout(() => {
            controller.poly2.triggerAttackRelease(notes2[3], "16n");
          }, sixteenthNoteMs * 3);
        });
        setToneController(controller);
        controller.transport.start();
        controller.loopBeat.start(0);
        controller.poly1.triggerAttack(["C4", "E4", "G4"]);
      });
    });
  };

  if (!movement.state.hasPermission || !toneController) {
    return (
      <div
        className="w-screen h-screen text-center flex flex-col items-center justify-center"
        onClick={start}
      >
        <button>tap to start</button>
      </div>
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
      className="w-screen h-screen"
      style={{ backgroundColor: `rgb(0, ${green}, ${blue})` }}
    >
      <div>
        <p>{debugText}</p>
        <p>Alpha (compass direction) : {round(orientationState.alpha)}</p>
        <p>
          Beta/X rotation (0 = on back, 90 = upright, 180 = facing down, -90 =
          upside down): {round(orientationState.beta)}
        </p>
        <p>
          Gamma/Y rotation (-89.99 = facing left, 0 = facing you, 90 = facing
          right):
          {round(orientationState.gamma)}
        </p>
      </div>
      <div>
        <p>
          Front to back control (upright = 100, upside down = 0):{" "}
          {round(orientationControl.frontToBack)}
        </p>
        <p>
          Compass control (forward/backward = 0, left/right = 100):{" "}
          {round(orientationControl.around)}
        </p>
      </div>
    </div>
  );
}

function getToneController(loopCallback: (time: Tone.Unit.Seconds) => void) {
  const loopBeat = new Tone.Loop((time) => {
    loopCallback(time);
  }, "4n");

  const gain1 = new Tone.Gain(1).toDestination();
  const gain2 = new Tone.Gain(1).toDestination();

  const poly1 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 1.5, decay: 0.2, sustain: 0.8, release: 4 },
  }).connect(gain1);
  const poly2 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 4 },
  }).connect(gain2);
  const transport = Tone.getTransport();

  return { transport, loopBeat, poly1, poly2, gain1, gain2 };
}

/** round to nearest hundredth */
function round(value: number | null) {
  if (value === null) return "null";
  return Math.round(value * 100) / 100;
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
