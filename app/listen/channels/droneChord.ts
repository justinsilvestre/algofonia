import * as Tone from "tone";
import { Chord, Scale, Key, Progression } from "tonal";

import { createChannel } from "../tone";
import { PulseSynth } from "./../synth/pulseSynth";

export type ToneControls = ReturnType<typeof getToneControls>;

export const droneChord = createChannel({
  key: "drone chord",
  initialize: () => {
    console.log("Initializing drone chord channel");

    const synth = new PulseSynth();
    synth.start();

    const octave = 3;
    const loopIndex = 0;

    return { loopIndex, synth, octave };
  },
  onLoop: ({ key, mode, chordRootScaleDegree, getChord }, channelState, time) => {
    channelState.loopIndex += 1;

    const scale  = `${key}${channelState.octave} ${mode}`;
    const notes  = Scale.get(scale).notes;
    const offset = channelState.loopIndex % 2; // 0 or 1

    channelState.synth.playChord(
      [notes[0+offset], notes[3+offset], notes[5+offset]], 
      "1n", 
      time+0.1
    );
      
    

    return channelState;
  },
  respond: (tone, { synth }, { frontToBack, around }) => {
    const gainValue = (frontToBack / 100 * 14) + 2;

    synth.gainLFOLFO.set({ max: gainValue});

    // const frequency = (around / 100 * 16) + 2;
    // synth.filterLFO.set({ frequency: frequency })

    // const modulationIndex = (around / 3);
    // synth.synth1.set({ modulationIndex }); 

    // const frequency = (around / 100);
    // synth.reverbLFO.set({ frequency });
  },
});
