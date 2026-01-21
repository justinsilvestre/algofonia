import * as Tone from "tone";
import { createChannel } from "../tone";

export const amSynth = createChannel({
  key: "AM Synth",
  initialize: () => {
    const amSynth = new Tone.AMSynth().toDestination();
    amSynth.set({
      harmonicity: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
      modulation: { type: "sawtooth" },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
    });

    const octave = 4;
    const notes = ["C4", "E4", "G4", "B4"]; // C major 7th chord
    const noteIndex = 0;

    return { amSynth, octave, notes, noteIndex };
  },
  teardown: (channelState) => {
    channelState.amSynth.dispose();
  },
  onLoop: (tone, channelState, time) => {
    const { amSynth, notes } = channelState;

    // Play arpeggiated pattern
    amSynth.triggerAttackRelease(notes[channelState.noteIndex], "4n", time);
    amSynth.triggerAttackRelease(
      notes[(channelState.noteIndex + 1) % notes.length],
      "4n",
      time + Tone.Time("4n").toSeconds()
    );
    amSynth.triggerAttackRelease(
      notes[(channelState.noteIndex + 2) % notes.length],
      "4n",
      time + Tone.Time("4n").toSeconds() * 2
    );
    amSynth.triggerAttackRelease(
      notes[(channelState.noteIndex + 3) % notes.length],
      "4n",
      time + Tone.Time("4n").toSeconds() * 3
    );

    // Cycle through starting notes
    channelState.noteIndex = (channelState.noteIndex + 1) % notes.length;

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    console.log("amSynth respond called", frontToBack, around);

    // Map frontToBack to modulation frequency (1Hz to 30Hz) for more noticeable tremolo
    const modulationFrequency = Math.round(1 + (frontToBack / 100) * 29);

    // Map around to harmonicity (0.5 to 8) for tonal character
    const harmonicity = 0.5 + (around / 100) * 7.5;

    channelState.amSynth.set({
      harmonicity,
      modulation: {
        modulationFrequency,
      },
    });

    // // Also adjust the modulation gain based on frontToBack to make the effect more obvious
    // const modulationGain = 0.2 + (frontToBack / 100) * 0.8; // 0.2 to 1.0
    // channelState.amSynth.modulation.volume.value =
    //   Tone.gainToDb(modulationGain);
  },
});
