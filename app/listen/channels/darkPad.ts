import * as Tone from "tone";
import { createChannel, ToneControls } from "../tone";
import { Scale } from "tonal";

import { DarkAmbientPad } from "../synth/darkPad";

const octave = 3;

function getLoop(tone: ToneControls, pad: DarkAmbientPad) {
  const { currentMeasureStartTime, key, mode } = tone;
  const scale = `${key}${octave} ${mode}`;
  const notes = Scale.get(scale).notes;
  const chordNotes = [notes[0], notes[3], notes[5]];
  const loop = new Tone.Loop((time) => {
    pad.playChordEternal(chordNotes, time);
  }, "1m");
  loop.start(currentMeasureStartTime);
  return { loop, chordNotes };
}

export const darkPad = createChannel({
  key: "Dark Ambient Pad",

  initialize: (tone) => {
    const pad = new DarkAmbientPad();
    pad.start();

    const loop = getLoop(tone, pad);

    return {
      pad,
      loop,
    };
  },
  teardown: ({ loop, pad }) => {
    pad.dispose();
    loop.loop.dispose();
  },
  respond: (
    { key, mode, currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { pad } = getState();

    // Control effects based on inputs
    const bitcrush = frontToBack / 100;
    const rate = (around / 100) * 6 + 6;

    pad.setBitCrush(bitcrush);
    pad.setBreathingRate(`${rate}hz`);

    // Update chord notes based on current key/mode
    const scale = `${key}${octave} ${mode}`;
    const notes = Scale.get(scale).notes;
    const newChordNotes = [notes[0], notes[3], notes[5]];

    const currentState = getState();
    const notesChanged =
      JSON.stringify(newChordNotes) !==
      JSON.stringify(currentState.loop.chordNotes);

    if (notesChanged) {
      // Restart loop with new notes
      currentState.loop.loop.dispose();

      const newLoop = getLoop(
        { key, mode, currentMeasureStartTime } as ToneControls,
        pad
      );

      setState((state) => ({
        ...state,
        loop: newLoop,
      }));
    }
  },
});
