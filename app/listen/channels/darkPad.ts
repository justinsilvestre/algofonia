import * as Tone from 'tone';
import { createChannel } from '../tone';
import { Chord, Scale, Key } from 'tonal';

import { DarkAmbientPad } from '../synth/darkPad';

export const darkPad = createChannel({
  key: 'Dark Ambient Pad',

  initialize: () => {
    const pad = new DarkAmbientPad();
    pad.start();

    const octave = 3;
    const isPlaying = false;

    return { pad, octave, isPlaying };
  },
  onLoop: ({ transport, key, mode }, channelState, time) => {
    if (channelState.isPlaying) return;

    const scale = `${key}${channelState.octave} ${mode}`;
    const notes = Scale.get(scale).notes;

    channelState.pad.playChordEternal([notes[0], notes[3], notes[5]], time);
    channelState.isPlaying = true;

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    const bitcrush = frontToBack / 100;
    const rate = (around / 100) * 6 + 6;

    channelState.pad.setBitCrush(bitcrush);
    channelState.pad.setBreathingRate(`${rate}hz`);

    return channelState;
  },
});
