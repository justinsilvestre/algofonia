import * as Tone from "tone";
import { createChannel } from "../tone";

export const droneChord = createChannel({
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
});
