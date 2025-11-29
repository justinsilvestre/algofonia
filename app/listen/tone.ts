import * as Tone from "tone";
import { MotionInputMessageToClient } from "../WebsocketMessage";

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
      loop.start(0);
      started = true;
      return Promise.resolve();
    },
    setBpm: (bpm: number) => {
      Tone.getTransport().bpm.value = bpm;
    },
    getBpm: () => {
      return Tone.getTransport().bpm.value;
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
};

export const createChannel = <ChannelState>({
  key,
  initialize,
  onLoop = (tone, channelState) => channelState,
  respond,
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
}): Channel<ChannelState> => {
  return {
    key,
    initialize,
    onLoop,
    respond,
  };
};
