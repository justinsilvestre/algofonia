import * as Tone from "tone";
import { createChannel, ToneControls } from "../tone";
import { Scale } from "tonal";

import { BrightAmbientPad } from "../synth/brightPad";

const octave = 4;

function getLoop(tone: ToneControls, pad: BrightAmbientPad) {
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

export const brightPad = createChannel({
  key: "Bright Ambient Pad",

  initialize: (tone) => {
    const pad = new BrightAmbientPad();

    pad.setDelayAmount(0.0);
    pad.setSparkleRate(1);
    pad.setSparkleDepth(0.1, 0.5);
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
    const delay = frontToBack / 100;
    const depthMin = around / 200 + 0.1;
    const depthMax = depthMin + 0.4;
    const rate = depthMin * 6;

    pad.setDelayAmount(delay);
    pad.setSparkleRate(rate);
    pad.setSparkleDepth(depthMin, depthMax);

    // Update chord notes based on current key/mode
    const scale = `${key}${octave} ${mode}`;
    const notes = Scale.get(scale).notes;
    const newChordNotes = [notes[0], notes[3], notes[5]];

    const currentState = getState();
    const notesChanged =
      JSON.stringify(newChordNotes) !==
      JSON.stringify(currentState.loop.chordNotes);

    if (notesChanged) {
      // Restart sequence with new notes
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
