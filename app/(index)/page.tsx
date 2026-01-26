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

  const visitors = useRef<Visitor[]>([]);

  const p5InstanceRef = useRef<p5 | null>(null);
  const followMouse = useRef(true);

  useWebsocket({
    handleMessage(message) {
      if (message.type === "PERSON_POSITION") {
        followMouse.current = false;
        if (!p5InstanceRef.current) return;

        const coordinates = toCanvasCoordinates(
          p5InstanceRef.current,
          message.x,
          message.y
        );
        if (visitors.current[message.personIdx]) {
          visitors.current[message.personIdx].position.set(
            coordinates.x,
            coordinates.y
          );
        } else {
          const newVisitor = new Visitor(
            p5InstanceRef.current,
            coordinates.x,
            coordinates.y
          );
          visitors.current[message.personIdx] = newVisitor;
        }
      }
    },
  });

  const loadSketch = useCallback(
    (p5Instance: p5, parent: RefObject<string | object | p5.Element>) => {
      p5InstanceRef.current = p5Instance;
      console.log("Loading sketch into parent:", parent.current);

      p5Instance.draw = () =>
        draw(p5Instance, controls, visitors.current, followMouse.current);
      p5Instance.setup = () => {
        setup(p5Instance, parent.current, visitors.current);
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
