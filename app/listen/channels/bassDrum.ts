import * as Tone from "tone";
import { createChannel } from "../tone";

export const bassDrum = createChannel({
  key: "bass drum",
  initialize: () => {
    const gain = new Tone.Gain(1).toDestination();
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
    }).connect(gain);

    return {
      synth,
      gain,
      note: "C1",
    };
  },
  teardown: ({ synth, gain }) => {
    synth.dispose();
    gain.dispose();
  },
  onLoop: (tone, { synth, note }, time) => {
    console.log("Looping bass drum at time:", time);
    synth.triggerAttackRelease(note, "8n", time);
    synth.triggerAttackRelease(note, "8n", time + Tone.Time("4n").toSeconds());
    synth.triggerAttackRelease(
      note,
      "8n",
      time + Tone.Time("4n").toSeconds() * 2
    );
    synth.triggerAttackRelease(
      note,
      "8n",
      time + Tone.Time("4n").toSeconds() * 3
    );
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    const { gain } = channelState;
    const gainValue = frontToBack / 30;
    gain.gain.rampTo(gainValue);
    console.log("Bass drum frontToBack:", frontToBack);

    if (around < 50) {
      channelState.note = "C1";
    } else {
      channelState.note = "C2";
    }
  },
});
