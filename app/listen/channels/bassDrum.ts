import * as Tone from "tone";
import { createChannel } from "../tone";

function getSequenceForPattern(synth: Tone.MembraneSynth, notes: string[]) {
  return new Tone.Sequence(
    (time, note) => {
      synth.triggerAttackRelease(note, "8n", time);
    },
    notes,
    "4n"
  );
}

export const bassDrum = createChannel({
  key: "bass drum",
  initialize: ({ currentMeasureStartTime }) => {
    const gain = new Tone.Gain(1).toDestination();
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
    }).connect(gain);

    const note = "C1";
    const sequence = getSequenceForPattern(synth, [note, note, note, note]);
    sequence.start(currentMeasureStartTime);

    return {
      synth,
      gain,
      note,

      sequence,
    };
  },
  teardown: ({ synth, gain, sequence }) => {
    synth.dispose();
    gain.dispose();
    sequence?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { gain, synth, sequence } = getState();

    // Control gain based on frontToBack
    const gainValue = frontToBack / 30;
    gain.gain.rampTo(gainValue);

    // Control note based on around
    const newNote = around < 50 ? "C1" : "C2";
    const currentState = getState();

    if (newNote !== currentState.note) {
      // Update sequence with new note
      if (sequence) sequence.dispose();

      const newSequence = getSequenceForPattern(synth, [
        newNote,
        newNote,
        newNote,
        newNote,
      ]);
      newSequence.start(currentMeasureStartTime);

      setState((state) => ({
        ...state,
        note: newNote,
        sequence: newSequence,
      }));
    }
  },
});
