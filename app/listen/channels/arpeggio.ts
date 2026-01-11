import * as Tone from 'tone';
import { createChannel } from '../tone';
import { Chord, Scale, Key } from 'tonal';

import { PluckSynth } from '../synth/pluckSynth';

export const arpeggio = createChannel({
  key: 'arpeggio',

  initialize: () => {
    const synth = new PluckSynth();
    synth.start();

    const octave = 3;
    const octaveJumpProb = 0.0;

    // Index of note in Scale.notes array
    const arpPatternIndices = [4, 2, 2, 4, 5, 1, 6, 3];

    return { synth, octave, octaveJumpProb, arpPatternIndices };
  },
  onLoop: (
    { key, mode, transport },
    { synth, octave, octaveJumpProb, arpPatternIndices },
    time
  ) => {
    for (let i = 0; i < arpPatternIndices.length; i += 1) {
      transport.schedule(
        (t) => {
          const noteOctave =
            Math.random() >= octaveJumpProb ? octave : octave + 1;
          const notes = Scale.get(`${key}${noteOctave} ${mode}`).notes;
          const note = notes[arpPatternIndices[i]];

          synth.playNote(note, '4n', t);
        },
        time + Tone.Time('4n').toSeconds() * (i + 1)
      );
    }
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    channelState.octaveJumpProb = around / 100;

    return channelState;
  },
});
