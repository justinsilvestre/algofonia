"use client";
import { useEffect, useState } from "react";
import {
  soundModulesDefinitions,
  soundModulesOrder,
} from "./soundModules/definitions";
import { SetState } from "./SoundModule";
import { SoundModuleOf } from "./soundModules/definitions";
import { SoundModuleKey } from "./soundModules/definitions";
import { useTone } from "./useTone";
import { ToneControls } from "./tone";
import {
  VisualsCanvas as NativeVisualsCanvas,
  useVisuals,
} from "./NativeVisualsCanvas";
import * as Tone from "tone";
import { useWebsocket } from "../useWebsocket";
import { getVisuals } from "./sketch/finalExhibitionVisuals";

type PersonPosition = {
  personId: number;
  x: number;
  y: number;
  handsRaised: boolean;
};

export default function PlayPage() {
  const [peoplePositions, setPeoplePositions] = useState<PersonPosition[]>([]);
  const [useExhibitionVisuals, setUseExhibitionVisuals] = useState(true); // Switch between visual systems

  const {
    controls,
    activeSoundModules,
    start: startSound,
    started,
    getSetState,
  } = useTone(soundModulesDefinitions, soundModulesOrder);

  const visuals = useVisuals({
    beforeStart: () => Tone.start(),
    toneControls: controls,
    initialize: getVisuals,
  });

  const { simulation } = useWebsocket({
    handleMessage(message) {
      if (message.type === "PEOPLE_POSITIONS") {
        setPeoplePositions(message.positions);

        // Update visuals if they're available
        if (visuals.instance?.onPositionsUpdate) {
          visuals.instance.onPositionsUpdate(message.positions);
        }
      }
    },
  });

  useEffect(() => {
    // simulate on press "S"
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "s" || event.key === "S") {
        simulation.toggleSimulation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [simulation]);

  return (
    <div
      id="container"
      className="min-w-screen min-h-screen text-white bg-black p-4"
    >
      <div className="flex flex-row flex-wrap justify-center items-center gap-6">
        <div className="shrink-0">
          <NativeVisualsCanvas visuals={visuals} />
        </div>

        {!started && (
          <button
            className="w-96 h-72 border border-white/20 rounded-lg cursor-pointer "
            onClick={() => {
              startSound();
            }}
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
