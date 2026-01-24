"use client";
import { channelsDefinitions, channelsOrder } from "./channels/definitions";
import { SetState } from "./Channel";
import { ChannelOf } from "./channels/definitions";
import { ChannelKey } from "./channels/definitions";
import { useTone } from "./SoundPlayer";
import { ToneControls } from "./tone";
import { useP5, VisualsCanvas } from "./VisualsCanvas";
import { Suspense } from "react";

export default function PlayPage() {
  const P5Class = useP5();
  const { controls, activeChannels, start, started, getSetState } = useTone(
    channelsDefinitions,
    channelsOrder
  );

  return (
    <div id="container" className="w-screen h-screen text-white bg-black p-4">
      <div className="flex gap-6 mt-4">
        <div className="shrink-0">
          <Suspense
            fallback={
              <div className="w-96 h-72 bg-gray-800 rounded-lg animate-pulse" />
            }
          >
            {P5Class && <VisualsCanvas P5Class={P5Class} />}
          </Suspense>
        </div>

        {!started && (
          <button
            className="w-100 h-100 border border-white/20 rounded-lg cursor-pointer "
            onClick={() => start()}
          >
            Start Audio
          </button>
        )}

        {/* Audio Controls */}
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
