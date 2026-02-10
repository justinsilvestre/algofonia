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
import { VisualsCanvas as NativeVisualsCanvas } from "./NativeVisualsCanvas";
import { useRef, useState } from "react";
import * as Tone from "tone";
import { useWebsocket } from "../useWebsocket";
import { VisualsState, initialVisualsState } from "./sketch/nativeVisuals";

export default function PlayPage() {
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

  const followMouse = useRef(true);

  useWebsocket({
    handleMessage(message) {
      if (message.type === "PEOPLE_POSITIONS") {
        console.log("got positions");
      }
    },
  });

  return (
    <div
      id="container"
      className="min-w-screen min-h-screen text-white bg-black p-4"
    >
      <div className="flex flex-row flex-wrap justify-center items-center gap-6">
        <div className="shrink-0">
          {visualsStarted && <NativeVisualsCanvas />}
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
