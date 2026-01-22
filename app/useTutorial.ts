"use client";
import { useCallback, useMemo } from "react";
import {
  MessageToServer,
  RoomState,
  TutorialStepName,
} from "./WebsocketMessage";
import { getRoomName } from "./getRoomName";

export interface TutorialState {
  isInQueue: boolean;
  isActive: boolean;
  isWaiting: boolean;
  currentStep: TutorialStepName | null;
  queuePosition: number;
  totalInQueue: number;
}

export interface Tutorial {
  state: TutorialState;
  startTutorial: () => void;
  endTutorial: () => void;
  progress: (step: TutorialStepName) => void;
  skip: () => void;
}

export function useTutorial({
  roomState,
  userId,
  sendMessage,
}: {
  roomState: RoomState;
  userId: number;
  sendMessage: (message: MessageToServer) => { OK: boolean; error?: string };
}): Tutorial {
  const state: TutorialState = useMemo(() => {
    const tutorial = roomState.tutorial;

    if (!tutorial) {
      return {
        isInQueue: false,
        isActive: false,
        isWaiting: false,
        currentStep: null,
        queuePosition: 0,
        totalInQueue: 0,
      };
    }

    const queuePosition = tutorial.queue.indexOf(userId);
    const isInQueue = queuePosition !== -1;
    const isActive = tutorial.currentUserId === userId;
    const isWaiting = isInQueue && !isActive;

    return {
      isInQueue,
      isActive,
      isWaiting,
      currentStep: isActive ? tutorial.currentStep : null,
      queuePosition: isInQueue ? queuePosition + 1 : 0, // 1-based position
      totalInQueue: tutorial.queue.length,
    };
  }, [roomState.tutorial, userId]);

  const startTutorial = useCallback(() => {
    const roomName = getRoomName();
    sendMessage({
      type: "TUTORIAL_START",
      roomName,
      userId,
    });
  }, [sendMessage, userId]);

  const endTutorial = useCallback(() => {
    const roomName = getRoomName();
    sendMessage({
      type: "TUTORIAL_END",
      roomName,
      userId,
    });
  }, [sendMessage, userId]);

  const progress = useCallback(
    (step: TutorialStepName) => {
      const roomName = getRoomName();
      sendMessage({
        type: "TUTORIAL_PROGRESS",
        roomName,
        userId,
        step,
      });
    },
    [sendMessage, userId]
  );

  const skip = useCallback(() => {
    endTutorial();
  }, [endTutorial]);

  return {
    state,
    startTutorial,
    endTutorial,
    progress,
    skip,
  };
}
