import * as Tone from "tone";
import { ReactNode } from "react";

import { MotionInputMessageToClient } from "../WebsocketMessage";
import { Key } from "tonal";

export type ToneControls = ReturnType<typeof getToneControls>;
export function getToneControls(
  loopCallback: (time: Tone.Unit.Seconds) => void
) {
  const transport = Tone.getTransport();
  let started = false;
  const loop = new Tone.Loop((time) => {
    loopCallback(time);
  }, "1m");

  return {
    get started() {
      return started;
    },
    transport,
    loop,
    start: (startBpm: number, startOffsetSeconds: Tone.Unit.Seconds) => {
      console.log(`Start time offset in seconds: ${startOffsetSeconds}`);
      transport.start(startOffsetSeconds);
      // set initial bpm
      Tone.getTransport().bpm.value = startBpm;

      // @ts-expect-error -- debug
      window.Tone = Tone;

      loop.start(0);
      started = true;

      return Promise.resolve();
    },
    setBpm: (bpm: number) => {
      const currentBpm = Tone.getTransport().bpm.value;
      const difference = Math.abs(bpm - currentBpm);
      const rampTime = difference > 20 ? 1 : difference > 10 ? 0.5 : 0.0;
      Tone.getTransport().bpm.rampTo(bpm, rampTime);
    },
    getBpm: () => {
      return Tone.getTransport().bpm.value;
    },
    key: "C",
    mode: "minor",
    chordRootScaleDegree: 1,
    getChord: (key: string, chordRootScaleDegree: number) => {
      return Key.majorKey(key).chords[chordRootScaleDegree - 1];
    },
  };
}

export type Channel<ChannelControls = null> = {
  key: string;
  initialize: (tone: ToneControls) => ChannelControls;
  onLoop: (
    tone: ToneControls,
    channel: ChannelControls,
    time: Tone.Unit.Seconds
  ) => ChannelControls | void;
  respond: (
    toneControls: ToneControls,
    channelControls: ChannelControls,
    input: MotionInputMessageToClient
  ) => ChannelControls | void;
  renderMonitorDisplay?: (
    channelControls: ChannelControls,
    toneControls: ToneControls,
    latestInput: { frontToBack: number; around: number }
  ) => ReactNode;
};

export const createChannel = <ChannelState>({
  key,
  initialize,
  onLoop = (tone, channelState) => channelState,
  respond,
  renderMonitorDisplay,
}: {
  key: string;
  initialize: (tone: ToneControls) => ChannelState;
  onLoop?: (
    tone: ToneControls,
    channel: ChannelState,
    time: Tone.Unit.Seconds
  ) => ChannelState | void;
  respond: (
    tone: ToneControls,
    channel: ChannelState,
    input: MotionInputMessageToClient
  ) => ChannelState | void;
  renderMonitorDisplay?: (
    channelState: ChannelState,
    toneControls: ToneControls,
    latestInput: { frontToBack: number; around: number }
  ) => ReactNode;
}): Channel<ChannelState> => {
  return {
    key,
    initialize,
    onLoop,
    respond,
    renderMonitorDisplay,
  };
};
