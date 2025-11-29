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
    start: (startBpm: number) => {
      transport.start();
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
export const channels = [
  createChannel({
    key: "drone chord",
    initialize: () => {
      console.log("Initializing drone chord channel");
      const gain = new Tone.Gain(1).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 1.5, decay: 0.2, sustain: 0.8, release: 4 },
      }).connect(gain);

      synth.triggerAttack(["C4", "E4", "G4"]);

      return { synth, gain };
    },
    respond: (tone, { synth, gain }, { frontToBack }) => {
      const gainValue = frontToBack / 100;
      gain.gain.rampTo(gainValue);
      console.log("Drone chord frontToBack:", frontToBack);
    },
  }),
  createChannel({
    key: "arpeggio",
    initialize: () => {
      const gain = new Tone.Gain(1).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 4 },
      }).connect(gain);

      return {
        synth,
        gain,
        notes: ["G4", "A4", "D5", "F5"],
      };
    },
    onLoop: (tone, { synth, notes }, time) => {
      console.log("Looping arpeggio at time:", time);
      synth.triggerAttackRelease(notes[0], "8n", time);
      synth.triggerAttackRelease(
        notes[1],
        "8n",
        time + Tone.Time("8n").toSeconds() * 1
      );
      synth.triggerAttackRelease(
        notes[2],
        "8n",
        time + Tone.Time("8n").toSeconds() * 2
      );
      synth.triggerAttackRelease(
        notes[3],
        "8n",
        time + Tone.Time("8n").toSeconds() * 3
      );
      synth.triggerAttackRelease(
        notes[2],
        "8n",
        time + Tone.Time("8n").toSeconds() * 4
      );
      synth.triggerAttackRelease(
        notes[1],
        "8n",
        time + Tone.Time("8n").toSeconds() * 5
      );
      synth.triggerAttackRelease(
        notes[0],
        "8n",
        time + Tone.Time("8n").toSeconds() * 6
      );
    },
    respond: (tone, { gain }, { around }) => {
      const gainValue = around / 70;
      console.log("Arpeggio around:", around, "setting gain to", gainValue);
      gain.gain.rampTo(gainValue);
    },
  }),
];
