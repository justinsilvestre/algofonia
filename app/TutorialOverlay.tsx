"use client";
import React from "react";
import { UseTutorialReturn } from "./useTutorial";

interface TutorialOverlayProps {
  tutorial: UseTutorialReturn;
}

export function TutorialOverlay({ tutorial }: TutorialOverlayProps) {
  const { tutorialState, startTutorial, skip } = tutorial;

  // Show tutorial start prompt if no tutorial is active and user is not in queue
  if (!tutorialState.isInQueue && !tutorialState.isActive) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg max-w-md mx-4 text-center">
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
  if (tutorialState.isWaiting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg max-w-md mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Please Wait</h2>
          <p className="text-white/80 mb-4">
            Another participant is currently in the tutorial. You're #
            {tutorialState.queuePosition} in the queue.
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
  if (tutorialState.isActive) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg max-w-md mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">
            Tutorial Active
          </h2>
          <p className="text-white/80 mb-4">
            Current step: {tutorialState.currentStep}
          </p>
          <p className="text-white/60 text-sm mb-6">
            Tutorial content will be implemented in the next phase.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={skip}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default TutorialOverlay;
