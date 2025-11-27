import * as Tone from "tone";
import { MotionInputMessageToClient } from "../WebsocketMessage";

export type ToneControls = ReturnType<typeof getToneControls>;
export function getToneControls(
  loopCallback: (time: Tone.Unit.Seconds) => void
) {
  return {
    transport: Tone.getTransport(),
    loop: new Tone.Loop((time) => {
      loopCallback(time);
    }, "4n"),
    setBpm: (bpm: number) => {
      Tone.getTransport().bpm.value = bpm;
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
      // synth.volume.rampTo(frontToBack / 100);
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
    onLoop: (tone, { synth, notes }) => {
      const sixteenthNoteMs = Tone.Time("16n").toMilliseconds();

      synth.triggerAttackRelease(notes[0], "16n");
      setTimeout(() => {
        synth.triggerAttackRelease(notes[1], "16n");
      }, sixteenthNoteMs);
      setTimeout(() => {
        synth.triggerAttackRelease(notes[2], "16n");
      }, sixteenthNoteMs * 2);
      setTimeout(() => {
        synth.triggerAttackRelease(notes[3], "16n");
      }, sixteenthNoteMs * 3);
    },
    respond: (tone, { gain }, { around }) => {
      const gainValue = around / 70;
      gain.gain.rampTo(gainValue);
    },
  }),
];
