import * as Tone from "tone";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { MotionInputMessageToClient } from "../WebsocketMessage";
import { Key } from "tonal";

export type ToneControls = ReturnType<typeof getToneControls>;
export function getToneControls(startBpm: number) {
  return {
    get transport() {
      return Tone.getTransport();
    },
    setBpm: (bpm: number) => {
      const currentBpm = Tone.getTransport().bpm.value;
      const difference = Math.abs(bpm - currentBpm);
      if (!difference) return;
      const rampTime = difference > 20 ? 1 : difference > 10 ? 0.5 : 0.0;
      if (rampTime === 0.0) {
        Tone.getTransport().bpm.value = bpm;
        return;
      }

      console.log(
        `Ramping BPM from ${currentBpm} to ${bpm} over ${rampTime} seconds`
      );
      Tone.getTransport().bpm.rampTo(bpm, rampTime);
    },
    getBpm: () => {
      const transport = Tone.getTransport();

      return transport?.bpm?.value ?? startBpm;
    },
    key: "C",
    mode: "minor",
    chordRootScaleDegree: 1,
    getChord: (key: string, chordRootScaleDegree: number) => {
      return Key.majorKey(key).chords[chordRootScaleDegree - 1];
    },
  };
}

export function startLoop(
  startBpm: number,
  startOffsetSeconds: Tone.Unit.Seconds,
  controls: ToneControls,
  loopCallback: (time: Tone.Unit.Seconds, controls: ToneControls) => void
) {
  const transport = Tone.getTransport();
  console.log(`Start time offset in seconds: ${startOffsetSeconds}`);
  transport.start(startOffsetSeconds);
  // set initial bpm
  transport.bpm.value = startBpm;

  // @ts-expect-error -- debug
  window.Tone = Tone;

  const loop = new Tone.Loop((time) => {
    loopCallback(time, controls);
  }, "1m");
  loop.start(0);

  return loop;
}

export type Channel<ChannelState = null> = {
  key: string;
  initialize: (tone: ToneControls) => ChannelState;
  teardown: (channelState: ChannelState) => void;
  onLoop: (
    tone: ToneControls,
    channel: ChannelState,
    time: Tone.Unit.Seconds
  ) => void;
  respond: (
    toneControls: ToneControls,
    channelState: ChannelState,
    input: { frontToBack: number; around: number }
  ) => void;
  renderMonitorDisplay?: (
    channelState: ChannelState,
    toneControls: ToneControls,
    latestInput: { frontToBack: number; around: number }
  ) => ReactNode;
};

export const createChannel = <ChannelState>({
  key,
  initialize,
  teardown,
  onLoop = (tone, channelState) => channelState,
  respond,
  renderMonitorDisplay,
}: {
  key: string;
  initialize: (tone: ToneControls) => ChannelState;
  teardown: (channelState: ChannelState) => void;
  onLoop?: (
    tone: ToneControls,
    channel: ChannelState,
    time: Tone.Unit.Seconds
  ) => void;
  respond: (
    tone: ToneControls,
    channel: ChannelState,
    input: { frontToBack: number; around: number }
  ) => void;
  renderMonitorDisplay?: (
    channelState: ChannelState,
    toneControls: ToneControls,
    latestInput: { frontToBack: number; around: number }
  ) => ReactNode;
}): Channel<ChannelState> => {
  return {
    key,
    initialize,
    teardown,
    onLoop,
    respond,
    renderMonitorDisplay,
  };
};
