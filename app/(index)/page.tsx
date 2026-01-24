"use client";
import { channelsDefinitions, channelsOrder } from "./channels/definitions";
import { SetState } from "./Channel";
import { ChannelOf } from "./channels/definitions";
import { ChannelKey } from "./channels/definitions";
import { useTone } from "./SoundPlayer";
import { ToneControls } from "./tone";
import { useP5, VisualsCanvas } from "./VisualsCanvas";
import p5 from "p5";
import { RefObject, useCallback, useState } from "react";
import { draw, setup } from "./sketch";

export default function PlayPage() {
  const P5Class = useP5();
  const { controls, activeChannels, start, started, getSetState } = useTone(
    channelsDefinitions,
    channelsOrder
  );
  const [visualsStarted, setVisualsStarted] = useState(false);
  const startVisuals = () => {
    if (!started) {
      start().then(() => setVisualsStarted(true));
    } else {
      setVisualsStarted(true);
    }
  };

  const loadSketch = useCallback(
    (p5Instance: p5, parent: RefObject<string | object | p5.Element>) => {
      console.log("Loading sketch into parent:", parent.current);

      p5Instance.draw = () => draw(p5Instance, controls);
      p5Instance.setup = () => setup(p5Instance, parent.current);
    },
    [controls]
  );

  return (
    <div id="container" className="w-screen h-screen text-white bg-black p-4">
      <div className="flex flex-row flex-wrap gap-6 mt-4">
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
        <div className="flex-1 space-y-4 text-white flex flex-row flex-wrap gap-4">
          {activeChannels.map((channel) => {
            return (
              <DisplayChannel
                key={channel.key}
                channel={channel}
                tone={controls}
                setState={getSetState(channel)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DisplayChannel<Key extends ChannelKey>({
  channel,
  tone,
  setState,
}: {
  channel: ChannelOf<Key>;
  tone: ToneControls;
  setState: SetState<ChannelOf<ChannelKey>["state"]>;
}) {
  const { definition } = channel;
  const state = channel.state;

  return <div>{definition.renderMonitorDisplay?.(state, setState, tone)}</div>;
}
