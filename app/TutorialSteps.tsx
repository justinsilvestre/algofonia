"use client";
import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { TutorialStepName } from "./WebsocketMessage";
import { Tutorial } from "./useTutorial";
import { getOrientationControlFromEvent } from "./movement-test/getOrientationControlFromEvent";

interface TutorialStepProps {
  tutorial: Tutorial;
  orientationControl: {
    frontToBack: number;
    around: number;
  };
  bpm: number | null;
}

interface StepComponentProps extends TutorialStepProps {
  onComplete: () => void;
}

// Intro step - welcome message
function IntroStep({ tutorial, onComplete }: StepComponentProps) {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-4 text-white">
        Welcome to Algofonia!
      </h2>
      <p className="text-white/80 mb-6 text-lg">
        Let's learn how to use motion controls to make music. We'll start with
        the two types of motion input.
      </p>
      <p className="text-white/60 mb-8 text-sm">
        Hold your phone and follow the instructions to move the orb on screen.
      </p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg"
      >
        Let's Begin!
      </button>
    </div>
  );
}

// frontToBack-learn step - show illustration
function FrontToBackLearnStep({ tutorial, onComplete }: StepComponentProps) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">
        Learn: Up & Down Motion
      </h2>
      <p className="text-white/80 mb-6">
        Tilt your phone like this to move the orb up and down:
      </p>

      {/* Phone illustration */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-24 h-40 bg-gray-600 rounded-lg border-2 border-gray-400 flex items-center justify-center">
            📱
          </div>
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className="text-white/60 text-xs">Tilt forward</div>
            <div className="text-2xl">↗️</div>
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="text-2xl">↘️</div>
            <div className="text-white/60 text-xs">Tilt back</div>
          </div>
        </div>
      </div>

      <p className="text-white/60 mb-8 text-sm">
        This controls the frontToBack value (0-100)
      </p>
      <button
        onClick={onComplete}
        className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
      >
        Got it!
      </button>
    </div>
  );
}

// frontToBack-top step - hold at top for 2 bars
function FrontToBackTopStep({
  tutorial,
  orientationControl,
  bpm,
  onComplete,
}: StepComponentProps) {
  const [beatsHeld, setBeatsHeld] = useState(0);
  const loop = useRef<Tone.Loop>(null);
  const drawInstance = useRef<Tone.DrawInstance>(null);
  const REQUIRED_BEATS = 8; // 2 bars = 8 beats
  const TARGET_VALUE = 100;
  const TOLERANCE = 7;

  const orientationControlRef = useOrientationControlRef(orientationControl);

  const isInTarget = (orientationControl: {
    frontToBack: number;
    around: number;
  }) => Math.abs(orientationControl.frontToBack - TARGET_VALUE) <= TOLERANCE;

  useEffect(() => {
    // Schedule the callback to run on each quarter note (beat)
    loop.current = new Tone.Loop((time) => {
      drawInstance.current = Tone.getDraw().schedule(() => {
        console.log("draw callback");
        if (isInTarget(orientationControlRef.current)) {
          setBeatsHeld((prev) => prev + 1);
        } else {
          setBeatsHeld(0);
        }
      }, time);
    }, "4n").start();

    return () => {
      loop.current?.dispose();
      drawInstance.current?.dispose();
    };
  }, [orientationControlRef]);

  useEffect(() => {
    if (beatsHeld >= REQUIRED_BEATS) {
      onComplete();
    }
  }, [beatsHeld, onComplete]);

  const progress = Math.min(beatsHeld / REQUIRED_BEATS, 1);
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Move to the Top</h2>
      <p className="text-white/80 mb-6">
        Move the orb to the top of the screen and hold it there until the
        progress bar fills up.
      </p>

      {/* Target zone indicator */}
      <div className="mb-6">
        <div className="text-white/60 text-sm mb-2">
          Target: frontToBack = {TARGET_VALUE} (±{TOLERANCE})
        </div>
        <div className="text-white text-lg">
          Current: {Math.round(orientationControl.frontToBack)}
        </div>
        <div
          className={`text-sm mt-2 ${isInTarget(orientationControl) ? "text-green-400" : "text-orange-400"}`}
        >
          {isInTarget(orientationControl)
            ? "✅ In target zone!"
            : "❌ Move to target zone"}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
          <div
            className="bg-green-500 h-4 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-white/60 text-sm">
          Hold for 2 bars ({REQUIRED_BEATS} beats) - {beatsHeld}/
          {REQUIRED_BEATS} beats held
        </div>
      </div>

      {progress > 0 && (
        <p className="text-green-400 text-sm">Great! Keep holding steady...</p>
      )}
    </div>
  );
}

// frontToBack-bottom step - hold at bottom for 2 bars
function FrontToBackBottomStep({
  tutorial,
  orientationControl,
  bpm,
  onComplete,
}: StepComponentProps) {
  const [beatsHeld, setBeatsHeld] = useState(0);
  const loop = useRef<Tone.Loop>(null);
  const drawInstance = useRef<Tone.DrawInstance>(null);
  const REQUIRED_BEATS = 8; // 2 bars = 8 beats
  const TARGET_VALUE = 0;
  const TOLERANCE = 7;

  const isInTarget = (orientationControl: {
    frontToBack: number;
    around: number;
  }) => Math.abs(orientationControl.frontToBack - TARGET_VALUE) <= TOLERANCE;

  const orientationControlRef = useOrientationControlRef(orientationControl);
  useEffect(() => {
    // Schedule the callback to run on each quarter note (beat)
    loop.current = new Tone.Loop((time) => {
      drawInstance.current = Tone.getDraw().schedule(() => {
        console.log("draw callback");
        if (isInTarget(orientationControlRef.current)) {
          setBeatsHeld((prev) => prev + 1);
        } else {
          setBeatsHeld(0);
        }
      }, time);
    }, "4n").start();

    return () => {
      loop.current?.dispose();
      drawInstance.current?.dispose();
    };
  }, [orientationControlRef]);

  useEffect(() => {
    if (beatsHeld >= REQUIRED_BEATS) {
      onComplete();
    }
  }, [beatsHeld, onComplete]);

  const progress = Math.min(beatsHeld / REQUIRED_BEATS, 1);
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Move to the Bottom</h2>
      <p className="text-white/80 mb-6">
        Nice! Now move the orb to the bottom of the screen and hold it there.
      </p>

      {/* Target zone indicator */}
      <div className="mb-6">
        <div className="text-white/60 text-sm mb-2">
          Target: frontToBack = {TARGET_VALUE} (±{TOLERANCE})
        </div>
        <div className="text-white text-lg">
          Current: {Math.round(orientationControl.frontToBack)}
        </div>
        <div
          className={`text-sm mt-2 ${isInTarget(orientationControl) ? "text-green-400" : "text-orange-400"}`}
        >
          {isInTarget(orientationControl)
            ? "✅ In target zone!"
            : "❌ Move to target zone"}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
          <div
            className="bg-green-500 h-4 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-white/60 text-sm">
          Hold for 2 bars ({REQUIRED_BEATS} beats) - {beatsHeld}/
          {REQUIRED_BEATS} beats held
        </div>
      </div>

      {progress > 0 && (
        <p className="text-green-400 text-sm">Excellent! Keep it steady...</p>
      )}
    </div>
  );
}

// Tutorial steps registry
export const tutorialSteps: Record<
  TutorialStepName,
  React.ComponentType<StepComponentProps>
> = {
  intro: IntroStep,
  "frontToBack-learn": FrontToBackLearnStep,
  "frontToBack-top": FrontToBackTopStep,
  "frontToBack-bottom": FrontToBackBottomStep,
  // Placeholder components for future steps
  "frontToBack-rhythm": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Rhythmic Motion</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "frontToBack-middle": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Middle Position</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "frontToBack-gradual": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Gradual Motion</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-learn": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Around Motion</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-vertical": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Vertical Alignment</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-horizontal": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">
        Horizontal Alignment
      </h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-rhythm": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Around Rhythm</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-diagonal": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Diagonal Alignment</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  "around-gradual": ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-white">Around Gradual</h2>
      <p className="text-white/80 mb-6">This step coming soon...</p>
      <button
        onClick={onComplete}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Continue
      </button>
    </div>
  ),
  complete: ({ onComplete }) => (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-4 text-white">
        🎉 Congratulations!
      </h2>
      <p className="text-white/80 mb-6">
        You've completed the tutorial! You're ready to make music.
      </p>
      <button
        onClick={onComplete}
        className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-medium"
      >
        Finish Tutorial
      </button>
    </div>
  ),
};

function useOrientationControlRef(orientationControl: {
  frontToBack: number;
  around: number;
}) {
  const orientationControlRef = useRef<{ frontToBack: number; around: number }>(
    orientationControl
  );
  useEffect(() => {
    const handleDeviceOrientationEvent = (e: DeviceOrientationEvent) => {
      if (!e.alpha || !e.beta) return;
      const orientationControl = getOrientationControlFromEvent(
        e.alpha,
        e.beta
      );
      orientationControlRef.current = orientationControl;
    };
    window.addEventListener(
      "deviceorientation",
      handleDeviceOrientationEvent,
      true // use capture to get events earlier
    );
    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientationEvent
      );
    };
  }, []);
  return orientationControlRef;
}
