import * as Tone from "tone";
import { createChannel } from "../tone";

export const arpeggio = createChannel({
  key: "arpeggio",
  initialize: () => {
    const gain = new Tone.Gain(1).toDestination();
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 4 },
    }).connect(gain);

    return {
      synth,
      gain,
      notes: ["G4", "A4", "D5", "F5"],
    };
  },
  onLoop: (tone, { synth, notes }, time) => {
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
});
