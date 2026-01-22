"use client";
import React from "react";
import { Tutorial } from "./useTutorial";
import { tutorialSteps } from "./TutorialSteps";
import { TutorialStepName } from "./WebsocketMessage";

interface TutorialOverlayProps {
  tutorial: Tutorial;
  orientationControl: {
    frontToBack: number;
    around: number;
  };
  bpm: number | null;
}

const STEP_PROGRESSION: Record<
  Exclude<TutorialStepName, "complete">,
  TutorialStepName
> = {
  intro: "frontToBack-learn",
  "frontToBack-learn": "frontToBack-top",
  "frontToBack-top": "frontToBack-bottom",
  "frontToBack-bottom": "frontToBack-rhythm",
  "frontToBack-rhythm": "frontToBack-middle",
  "frontToBack-middle": "frontToBack-gradual",
  "frontToBack-gradual": "around-learn",
  "around-learn": "around-vertical",
  "around-vertical": "around-horizontal",
  "around-horizontal": "around-rhythm",
  "around-rhythm": "around-diagonal",
  "around-diagonal": "around-gradual",
  "around-gradual": "complete",
};

export function TutorialOverlay({
  tutorial,
  orientationControl,
  bpm,
}: TutorialOverlayProps) {
  const { state, startTutorial, skip, progress } = tutorial;

  // Show tutorial start prompt if no tutorial is active and user is not in queue
  if (!state.isInQueue && !state.isActive) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="p-6 rounded-lg max-w-md mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">
            Welcome to Algofonia!
          </h2>
          <p className="text-white/80 mb-6">
            Let's learn how to use motion controls to make music. The tutorial
            will guide you through the two types of motion input.
          </p>
          <button
            onClick={startTutorial}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Start Tutorial
          </button>
        </div>
      </div>
    );
  }

  // Show waiting message if user is in queue but not active
  if (state.isWaiting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="p-6 rounded-lg max-w-md mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Please Wait</h2>
          <p className="text-white/80 mb-4">
            Another participant is currently in the tutorial. You're #
            {state.queuePosition} in the queue.
          </p>
          <p className="text-white/60 text-sm mb-6">
            Your motion controls are paused until it's your turn.
          </p>
          <button
            onClick={skip}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
          >
            Leave Queue
          </button>
        </div>
      </div>
    );
  }

  // Show active tutorial interface if user is the active tutorial user
  if (state.isActive && state.currentStep) {
    const StepComponent = tutorialSteps[state.currentStep];

    const handleStepComplete = () => {
      const nextStep =
        state.currentStep &&
        state.currentStep !== "complete" &&
        STEP_PROGRESSION[state.currentStep];
      if (nextStep) {
        progress(nextStep as import("./WebsocketMessage").TutorialStepName);
      } else {
        // End of tutorial
        skip();
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="p-8 rounded-lg max-w-lg mx-4 min-h-[400px] flex flex-col justify-between">
          {/* Progress indicator */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-white/60 text-sm">
              Tutorial Step: {state.currentStep}
            </div>
            <button
              onClick={skip}
              className="bg-red-500/70 hover:bg-red-500 text-white px-3 py-1 rounded text-sm"
            >
              Skip Tutorial
            </button>
          </div>

          {/* Step content */}
          <div className="flex-1">
            <StepComponent
              tutorial={tutorial}
              orientationControl={orientationControl}
              bpm={bpm}
              onComplete={handleStepComplete}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
