import * as Tone from "tone";
import { Chord, Key, Scale } from "tonal";
import { createChannel } from "../tone";
import { RecursivePartial } from "tone/build/esm/core/util/Interface";

import { BassSynth } from "./../synth/bassSynth";

const forwardProgression = new Map([
  [1, 5],
  [5, 4],
  [4, 7],
  [7, 5],
]);
const resolution = new Map([
  [1, 1],
  [5, 1],
  [4, 1],
  [7, 1],
]);
// a more complex progression scheme based on the circle of fifths
// const forwardProgression = new Map([
//   [1, 5], // I to V (in major)
//   [2, 6], // ii to vi
//   [3, 7], // iii to vii°
//   [4, 1], // IV to I
//   [5, 2], // V to ii
//   [6, 3], // vi to iii
//   [7, 4], // vii° to IV
// ]);
// const resolution = new Map([
//   [1, 1], // I stays at 1
//   [2, 5], // ii to I
//   [3, 6], // iii to vi
//   [4, 1], // IV to I
//   [5, 1], // V to I
//   [6, 4], // vi to I
//   [7, 1], // vii° to I
// ]);

type RhythmEvent = Tone.Unit.Time | null;
type RhythmSpeed = 0 | 1 | 2 | 3 | 4;

// prettier-ignore
const rhythmVariations = new Map<RhythmSpeed, RhythmEvent[]>([
  [0, ['1n', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]],
  [1, ['2n', null, null, null, null, null, null, null, '2n', null, null, null, null, null, null, null]],
  [2, [null, null, '8n', null, null, null, '8n', null, null, null, '8n', null, null, null, '8n', null]],
  [3, ['4n', null, null, null, '8n', null, '8n', null, '8n', null, '8n', null, '4n', null, null, null]],
  [4, ['8n', null, '8n', null, '16n', '16n', '8n', null, '16n','16n','16n','16n', '8n', null, '8n', null]],
]);

function getSequenceForRhythm(
  rhythmSpeed: RhythmSpeed,
  synth: BassSynth,
  getNote: () => string
) {
  const rhythm = rhythmVariations.get(rhythmSpeed)!;

  return new Tone.Sequence<RhythmEvent>(
    (time, rhythmEvent) => {
      if (rhythmEvent) {
        const note = getNote();
        synth.playNote(note, rhythmEvent, time);
      }
    },
    rhythm,
    "16n"
  );
}

export const bass = createChannel({
  key: "Bass",
  initialize: ({ currentMeasureStartTime, key, mode }) => {
    console.log("All scale names", Scale.names());

    const synth = new BassSynth();
    synth.start();

    const octave = 1;
    const rhythmSpeed = 0 as RhythmSpeed;
    let loopIndex = 0;

    const getNote = () => {
      const scaleNotes = Scale.get(`${key} ${mode}`).notes;
      const note = `${scaleNotes[loopIndex % scaleNotes.length]}${octave}`;
      loopIndex += 1;
      return note;
    };

    const sequence = getSequenceForRhythm(rhythmSpeed, synth, getNote);
    sequence.start(currentMeasureStartTime);

    return {
      synth,
      sequence,
      octave,
      rhythmSpeed,
      loopIndex,
      getNote,
    };
  },
  teardown: ({ synth, sequence }) => {
    synth.dispose();
    sequence?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { around }
  ) => {
    const { sequence, synth, getNote } = getState();

    // Determine new rhythm speed based on around input
    let newRhythmSpeed: RhythmSpeed;
    if (around <= 24) {
      newRhythmSpeed = 1;
    } else if (around <= 49) {
      newRhythmSpeed = 2;
    } else if (around <= 74) {
      newRhythmSpeed = 3;
    } else {
      newRhythmSpeed = 4;
    }

    // Update sequence if rhythm speed changed
    const currentState = getState();
    if (newRhythmSpeed !== currentState.rhythmSpeed) {
      if (sequence) sequence.dispose();

      const newSequence = getSequenceForRhythm(newRhythmSpeed, synth, getNote);
      newSequence.start(currentMeasureStartTime);

      setState((state) => ({
        ...state,
        rhythmSpeed: newRhythmSpeed,
        sequence: newSequence,
      }));
    }

    // Update chord progression based on frontToBack
    // This will be handled by the tone context, we just need to trigger the change
    // The actual chordRootScaleDegree update should happen in the tone context
  },
});
