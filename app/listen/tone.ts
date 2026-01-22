import * as Tone from "tone";
import { ReactNode } from "react";
import { Key } from "tonal";

export type ToneControls = ReturnType<typeof getToneControls>;
export function getToneControls(startBpm: number) {
  let targetBpm = startBpm;
  return {
    get currentMeasureStartTime() {
      const position = Tone.getTransport().position as string;

      const currentBar = position.split(":")[0];

      return Tone.Time(`${currentBar}:0:0`).toSeconds();
    },
    get transport() {
      return Tone.getTransport();
    },
    setBpm: (bpm: number) => {
      const currentBpm = Tone.getTransport().bpm.value;
      const difference = Math.abs(bpm - currentBpm);
      if (!difference) return;
      const rampTime = difference > 20 ? 1 : difference > 10 ? 0.5 : 0.01;

      console.log(
        `Ramping BPM from ${currentBpm} to ${bpm} over ${rampTime} seconds`
      );
      Tone.getTransport().bpm.rampTo(bpm, rampTime);
      targetBpm = bpm;
    },
    /** The current bpm OR the BPM that has been set as the target for ramping */
    getTargetBpm: () => targetBpm,
    /** Gets current bpm, which may be in the process of ramping to the target bpm */
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

export type SetState<ChannelState> = (
  state: ChannelState | ((prevState: ChannelState) => ChannelState)
) => void;
type ChannelStateHelpers<ChannelState> = {
  getState: () => ChannelState;
  setState: SetState<ChannelState>;
};

export type Channel<ChannelState = null> = {
  key: string;
  initialize: (tone: ToneControls) => ChannelState;
  teardown: (channelState: ChannelState) => void;
  respond: (
    toneControls: ToneControls,
    ChannelStateHelpers: ChannelStateHelpers<ChannelState>,
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
  respond,
  renderMonitorDisplay,
}: Channel<ChannelState>): Channel<ChannelState> => {
  return {
    key,
    initialize,
    teardown,
    respond,
    renderMonitorDisplay,
  };
};
