import * as Tone from "tone";
import { createChannel, ToneControls } from "../tone";
import { Scale } from "tonal";

import { PluckSynth } from "../synth/pluckSynth";

export const arpeggio = createChannel({
  key: "arpeggio",

  initialize: (tone) => {
    const synth = new PluckSynth();
    synth.start();

    const octaveJumpProb = 0.0;

    const pattern = getArpeggioPattern(tone, synth, octaveJumpProb);
    pattern.start(tone.currentMeasureStartTime);

    return { synth, pattern };
  },
  teardown: (channelState) => {
    channelState.synth.dispose();
    channelState.pattern.dispose();
  },
  respond: (tone, { setState }, { around }) => {
    const octaveJumpProb = around / 100;
    setState((state) => ({
      ...state,
      pattern: getArpeggioPattern(tone, state.synth, octaveJumpProb),
    }));
  },
});

type ArpeggioNoteEvent = {
  scaleDegree: number;
  octaveOffset: number;
};
const arpPatternIndices = [4, 2, 2, 4, 5, 1, 6, 3];
function getArpeggioPattern(
  tone: ToneControls,
  synth: PluckSynth,
  octaveJumpProb: number
) {
  const notes: ArpeggioNoteEvent[] = arpPatternIndices.map((scaleDegree) => {
    return {
      scaleDegree,
      octaveOffset: 3 + (Math.random() < octaveJumpProb ? 1 : 0),
    };
  });
  return new Tone.Pattern(
    (time, noteEvent) => {
      const { key, mode } = tone;
      const noteOctave = 3 + noteEvent.octaveOffset;
      const notes = Scale.get(`${key}${noteOctave} ${mode}`).notes;
      const note = notes[noteEvent.scaleDegree];
      synth.playNote(note, "4n", time);
    },
    notes,
    "up"
  );
}
