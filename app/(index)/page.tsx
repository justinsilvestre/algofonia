"use client";
import {
  soundModulesDefinitions,
  soundModulesOrder,
} from "./soundModules/definitions";
import { SetState } from "./SoundModule";
import { SoundModuleOf } from "./soundModules/definitions";
import { SoundModuleKey } from "./soundModules/definitions";
import { useTone } from "./useTone";
import { ToneControls } from "./tone";
import { useP5, VisualsCanvas } from "./VisualsCanvas";
import p5 from "p5";
import { RefObject, useCallback, useRef, useState } from "react";
import { draw, setup } from "./sketch/sketch";
import * as Tone from "tone";
import { useWebsocket } from "../useWebsocket";
import { Visitor } from "./sketch/Visitor";

export default function PlayPage() {
  const P5Class = useP5();
  const { controls, activeSoundModules, start, started, getSetState } = useTone(
    soundModulesDefinitions,
    soundModulesOrder
  );
  const [visualsStarted, setVisualsStarted] = useState(false);
  const startVisuals = () => {
    if (!started) {
      Tone.start().then(() => setVisualsStarted(true));
    } else {
      setVisualsStarted(true);
    }
  };

  const visitors = useRef<Map<number, Visitor>>(new Map());

  const p5InstanceRef = useRef<p5 | null>(null);
  const followMouse = useRef(true);

  useWebsocket({
    handleMessage(message) {
      console.log("Received message:", message);
      if (message.type === "PEOPLE_POSITIONS") {
        if (!p5InstanceRef.current) return;

        // Clear default visitors when motion tracking starts
        if (visitors.current.has(-1) || visitors.current.has(-2)) {
          visitors.current.delete(-1);
          visitors.current.delete(-2);
          console.log("Cleared default visitors, motion tracking active");
        }

        // Get current visitor IDs
        const currentVisitorIds = new Set(visitors.current.keys());
        const newVisitorIds = new Set(message.positions.map((p) => p.personId));

        // Remove visitors that are no longer present
        for (const visitorId of currentVisitorIds) {
          if (visitorId >= 0 && !newVisitorIds.has(visitorId)) {
            visitors.current.delete(visitorId);
            console.log(`Person ${visitorId} left the frame`);
          }
        }

        // Update or create visitors for current positions
        for (const position of message.positions) {
          const coordinates = toCanvasCoordinates(
            p5InstanceRef.current,
            position.x,
            position.y
          );

          const existingVisitor = visitors.current.get(position.personId);
          if (existingVisitor) {
            existingVisitor.position.set(coordinates.x, coordinates.y);
          } else {
            const newVisitor = new Visitor(
              p5InstanceRef.current,
              coordinates.x,
              coordinates.y
            );
            visitors.current.set(position.personId, newVisitor);
            console.log(`Person ${position.personId} entered the frame`);
          }
        }

        // Update follow mouse state
        const hasMotionTrackedVisitors = Array.from(
          visitors.current.keys()
        ).some((id) => id >= 0);
        followMouse.current = !hasMotionTrackedVisitors;

        if (!hasMotionTrackedVisitors) {
          console.log(
            "No motion-tracked visitors remaining, switching to mouse follow mode"
          );
        } else {
          followMouse.current = false;
        }
      }
    },
  });

  const loadSketch = useCallback(
    (p5Instance: p5, parent: RefObject<string | object | p5.Element>) => {
      p5InstanceRef.current = p5Instance;
      console.log("Loading sketch into parent:", parent.current);

      p5Instance.draw = () => {
        // Convert Map to array for sketch
        const visitorsArray = Array.from(visitors.current.values());
        draw(p5Instance, controls, visitorsArray, followMouse.current);
      };
      p5Instance.setup = () => {
        // Convert Map to array for sketch setup
        const visitorsArray = Array.from(visitors.current.values());
        setup(p5Instance, parent.current, visitorsArray);

        // Initialize with default visitors if none exist (after p5 setup is complete)
        if (visitors.current.size === 0) {
          // Use negative IDs for default visitors to avoid conflicts with motion tracking
          visitors.current.set(-1, new Visitor(p5Instance, 100, 100));
          visitors.current.set(-2, new Visitor(p5Instance, 200, 100));
        }
      };
    },
    [controls]
  );

  return (
    <div
      id="container"
      className="min-w-screen min-h-screen text-white bg-black p-4"
    >
      <div className="flex flex-row flex-wrap justify-center items-center gap-6">
        <div className="shrink-0">
          {P5Class && visualsStarted && (
            <VisualsCanvas P5Class={P5Class} loadSketch={loadSketch} />
          )}
          {!visualsStarted && (
            <button
              className="w-96 h-72 border border-white/20 rounded-lg cursor-pointer flex items-center justify-center text-lg"
              onClick={startVisuals}
            >
              Start Visuals
            </button>
          )}
        </div>

        {!started && (
          <button
            className="w-96 h-72 border border-white/20 rounded-lg cursor-pointer "
            onClick={() => start()}
          >
            Start Audio
          </button>
        )}

        {activeSoundModules.map((soundModule) => {
          return (
            <DisplaySoundModule
              key={soundModule.key}
              soundModule={soundModule}
              tone={controls}
              setState={getSetState(soundModule)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DisplaySoundModule<Key extends SoundModuleKey>({
  soundModule,
  tone,
  setState,
}: {
  soundModule: SoundModuleOf<Key>;
  tone: ToneControls;
  setState: SetState<SoundModuleOf<SoundModuleKey>["state"]>;
}) {
  const { definition } = soundModule;
  const state = soundModule.state;

  return <>{definition.renderMonitorDisplay?.(state, setState, tone)}</>;
}

/** not final! */
function toCanvasCoordinates(
  p5Instance: p5,
  gridX: number,
  gridY: number
): { x: number; y: number } {
  // Grid extents in meters
  const MIN_X = 0.37918;
  const MAX_X = 3.77447;
  const MIN_Y = -0.32095;
  const MAX_Y = 2.91386;

  // Map grid coordinates to canvas coordinates
  const x = p5Instance.map(gridX, MIN_X, MAX_X, 0, p5Instance.width);
  const y = p5Instance.map(gridY, MIN_Y, MAX_Y, 0, p5Instance.height);

  return { x, y };
}
