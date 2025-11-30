import * as Tone from "tone";
import { createChannel } from "../tone";
import { Chord, Key } from "tonal";

export const droneChord = createChannel({
  key: "drone chord",
  initialize: () => {
    console.log("Initializing drone chord channel");
    const gain1 = new Tone.Gain(1).toDestination();
    const gain2 = new Tone.Gain(1).toDestination();
    const synthSettings = {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.1 },
    } as const;

    return {
      synths: [
        new Tone.Synth(synthSettings).connect(gain1),
        new Tone.Synth(synthSettings).connect(gain1),
        new Tone.Synth(synthSettings).connect(gain2),
        new Tone.Synth(synthSettings).connect(gain2),
      ],
      gain1,
      gain2,
    };
  },
  onLoop: ({ key, chordRootScaleDegree, getChord }, { synths }, time) => {
    const currentChord = getChord(key, chordRootScaleDegree);
    const notes = Chord.get(currentChord).notes.map((letterWithoutNumber) =>
      Tone.Frequency(letterWithoutNumber + "4").toNote()
    );
    notes.forEach((note, i) =>
      synths[i].triggerAttackRelease(note, "1m", time)
    );
  },
  respond: (tone, { gain1: gain, gain2 }, { frontToBack, around }) => {
    const gainValue = frontToBack / 100;
    gain.gain.rampTo(gainValue);
    console.log("Drone chord frontToBack:", frontToBack);
    const gain2Value = around / 100;
    gain2.gain.rampTo(gain2Value);
  },
});
