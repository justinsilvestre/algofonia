import * as Tone from "tone";
import { Chord, Key, Scale } from "tonal";
import { createChannel } from "../tone";

export const synth = createChannel({
  key: "Synth",
  initialize: () => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.set({
      oscillator: { type: "triangle" },
      // envelope: { attack: 0.05, decay: 0.1, sustain: 0.5, release: 1 },
    });

    const octave = 4;

    return { synth, octave, note: "C4" };
  },
  teardown: (channelState) => {
    channelState.synth.dispose();
  },
  onLoop: (tone, channelState, time) => {
    const { synth } = channelState;
    synth.triggerAttackRelease(channelState.note, "4n", time);
    synth.triggerAttackRelease(
      channelState.note,
      "4n",
      time + Tone.Time("4n").toSeconds()
    );
    synth.triggerAttackRelease(
      channelState.note,
      "4n",
      time + Tone.Time("4n").toSeconds() * 2
    );
    synth.triggerAttackRelease(
      channelState.note,
      "4n",
      time + Tone.Time("4n").toSeconds() * 3
    );
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    console.log("synth respond called", frontToBack, around);
    if (frontToBack < 25) {
      if (channelState.synth.get().oscillator.type !== "sine")
        channelState.synth.set({ oscillator: { type: "sine" } });
    } else if (frontToBack < 50) {
      if (channelState.synth.get().oscillator.type !== "triangle")
        channelState.synth.set({ oscillator: { type: "triangle" } });
    } else if (frontToBack < 75) {
      if (channelState.synth.get().oscillator.type !== "sawtooth")
        channelState.synth.set({ oscillator: { type: "sawtooth" } });
    } else {
      if (channelState.synth.get().oscillator.type !== "square")
        channelState.synth.set({ oscillator: { type: "square" } });
    }

    if (around < 25) {
      channelState.note = "C4";
    } else if (around < 50) {
      channelState.note = "C5";
    } else if (around < 75) {
      channelState.note = "C6";
    } else {
      channelState.note = "C7";
    }
  },
});
