"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MessageToClient, MessageToServer } from "./WebsocketMessage";
import { useWebsocketUrl } from "@/app/useWebsocketUrl";
import { useDidChange } from "./listen/useDidChange";

type SimulationConfig = {
  updateFrequency: number; // Hz (updates per second)
  numPeople: number;
  roomWidth: number; // meters
  roomHeight: number; // meters
  cycleDuration: number; // seconds for complete movement cycle
};

const defaultSimulationConfig: SimulationConfig = {
  updateFrequency: 5,
  numPeople: 3,
  roomWidth: 3.5,
  roomHeight: 3,
  cycleDuration: 8,
};

type SimulatedPerson = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  handsRaisedStartTime: number;
  handsRaisedDuration: number;
};

function createSimulatedPeople(config: SimulationConfig): SimulatedPerson[] {
  return Array.from({ length: config.numPeople }, (_, index) => ({
    id: index + 1,
    startX: Math.random() * config.roomWidth,
    startY: Math.random() * config.roomHeight,
    endX: Math.random() * config.roomWidth,
    endY: Math.random() * config.roomHeight,
    handsRaisedStartTime: Math.random() * config.cycleDuration,
    handsRaisedDuration: 1 + Math.random() * 2, // 1-3 seconds
  }));
}

function updateSimulatedPerson(
  person: SimulatedPerson,
  progress: number,
  config: SimulationConfig
): { personId: number; x: number; y: number; handsRaised: boolean } {
  // Use smooth interpolation
  const t = 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);

  const x = person.startX + (person.endX - person.startX) * t;
  const y = person.startY + (person.endY - person.startY) * t;

  // Determine hands raised state
  const cycleTime = progress * config.cycleDuration;
  const handsRaised =
    cycleTime >= person.handsRaisedStartTime &&
    cycleTime < person.handsRaisedStartTime + person.handsRaisedDuration;

  return {
    personId: person.id,
    x,
    y,
    handsRaised,
  };
}

export function usePositionSimulation(
  config: Partial<SimulationConfig> = {},
  onMessage?: (
    message: MessageToClient,
    sendMessage: (message: MessageToServer) => void
  ) => void
): {
  simulationEnabled: boolean;
  toggleSimulation: () => void;
  updateConfig: (newConfig: Partial<SimulationConfig>) => void;
  currentConfig: SimulationConfig;
} {
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>({
    ...defaultSimulationConfig,
    ...config,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const simulatedPeopleRef = useRef<SimulatedPerson[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastUpdateTimeRef = useRef<number>(0);
  const cycleStartTimeRef = useRef<number>(0);

  const sendSimulatedMessage = useCallback(() => {
    if (!onMessage) return;

    const now = performance.now();
    const cycleProgress =
      ((now - cycleStartTimeRef.current) %
        (simulationConfig.cycleDuration * 1000)) /
      (simulationConfig.cycleDuration * 1000);

    const positions = simulatedPeopleRef.current.map((person) =>
      updateSimulatedPerson(person, cycleProgress, simulationConfig)
    );

    const message: MessageToClient = {
      type: "PEOPLE_POSITIONS",
      positions,
    };

    onMessage(message, () => {}); // Empty sendMessage function for simulation
  }, [onMessage, simulationConfig]);

  const enableSimulation = useCallback(() => {
    console.log("Enabling simulation");
    simulatedPeopleRef.current = createSimulatedPeople(simulationConfig);
    cycleStartTimeRef.current = performance.now();
    lastUpdateTimeRef.current = performance.now();
  }, [simulationConfig]);

  const disableSimulation = useCallback(() => {
    console.log("Disabling simulation");
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (isSimulating) {
      enableSimulation();
    } else {
      disableSimulation();
    }
    // Cleanup on unmount
    return () => {
      disableSimulation();
    };
  }, [isSimulating, enableSimulation, disableSimulation]);

  const updateConfig = useCallback((newConfig: Partial<SimulationConfig>) => {
    setSimulationConfig((prev) => {
      const updated = { ...prev, ...newConfig };

      // If number of people changed, recreate the simulated people
      if (
        newConfig.numPeople !== undefined &&
        newConfig.numPeople !== prev.numPeople
      ) {
        simulatedPeopleRef.current = createSimulatedPeople(updated);
      }

      return updated;
    });
  }, []);

  useEffect(() => {
    const animate = () => {
      if (!isSimulating) return;

      const now = performance.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const updateInterval = 1000 / simulationConfig.updateFrequency;

      if (timeSinceLastUpdate >= updateInterval) {
        sendSimulatedMessage();
        lastUpdateTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isSimulating) {
      animate();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, simulationConfig.updateFrequency, sendSimulatedMessage]);

  return {
    toggleSimulation: useCallback(() => {
      setIsSimulating((enabled) => !enabled);
    }, []),
    updateConfig,
    currentConfig: simulationConfig,
    simulationEnabled: isSimulating,
  };
}

type ConnectionState =
  | {
      type: "initial" | "connecting" | "connected" | "disconnected";
    }
  | {
      type: "error";
      message: string;
    };

export function useWebsocket(options: {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  handleMessage: (
    message: MessageToClient,
    sendMessage: (message: MessageToServer) => void
  ) => void;
  simulationConfig?: Partial<SimulationConfig>;
}) {
  const url = useWebsocketUrl();
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    handleMessage,
    simulationConfig = {},
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    type: "initial",
  });
  const [reconnectAttemptsCount, setReconnectAttemptsCount] = useState(0);

  // Initialize simulation if enabled
  const simulation = usePositionSimulation(simulationConfig, handleMessage);

  useEffect(() => {
    if (!url) return;
    if (socket?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }
    if (socket?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connection in progress");
      return;
    }
    if (socket?.readyState === WebSocket.CLOSING) {
      console.log("WebSocket is closing, will not attempt to reconnect now");
      return;
    }
    if (socket?.readyState === WebSocket.CLOSED) {
      console.log("WebSocket is closed, attempting to reconnect");
    }

    try {
      console.log(`Connecting to WebSocket at ${url}...`);
      setConnectionState({ type: "connecting" });
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log("WebSocket connected");
        setConnectionState({ type: "connected" });
        setReconnectAttemptsCount(0);
      };
      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionState({ type: "disconnected" });
        if (reconnectAttemptsCount < maxReconnectAttempts) {
          console.log(
            `Reconnecting in ${reconnectInterval}ms... (attempt ${
              reconnectAttemptsCount + 1
            }/${maxReconnectAttempts})`
          );
          setTimeout(() => {
            setReconnectAttemptsCount((count) => count + 1);
            setSocket(null); // Trigger reconnection
          }, reconnectInterval);
        } else {
          console.log("Max reconnect attempts reached");
          setConnectionState({
            type: "error",
            message: "Max reconnect attempts reached",
          });
        }
      };
      socket.onerror = (error) => {
        console.log("WebSocket error:", error);
        setConnectionState({
          type: "error",
          message: `WebSocket error: ${error.type}`,
        });
      };

      setSocket(socket);
    } catch (error) {
      console.error(`Failed to create WebSocket connection:`, error);
      setConnectionState({
        type: "error",
        message: "Failed to create WebSocket connection",
      });
    }
  }, [
    url,
    socket,
    reconnectAttemptsCount,
    maxReconnectAttempts,
    reconnectInterval,
  ]);

  const sendMessage = useCallback(
    (message: MessageToServer) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return { OK: true };
      } else {
        console.warn(
          `WebSocket is not connected; cannot send message ${JSON.stringify(
            message
          )}`
        );
        return { OK: false, error: "WebSocket is not connected" };
      }
    },
    [socket]
  );

  useEffect(() => {
    if (!socket || !handleMessage) return;
    // eslint-disable-next-line react-hooks/immutability
    socket.onmessage = (event) => {
      try {
        const message: MessageToClient = JSON.parse(event.data);
        handleMessage(message, sendMessage);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
    return () => {
      socket.onmessage = null;
    };
  }, [socket, handleMessage, sendMessage]);

  return {
    socket,
    connectionState,
    sendMessage,
    simulation, // Expose simulation controls
  };
}
