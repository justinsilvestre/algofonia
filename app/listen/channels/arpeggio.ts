import * as Tone from "tone";
import { createChannel } from "../tone";
import { Chord, Key } from "tonal";

// prettier-ignore
const rhythmVariations = new Map<
  number, (string| null)[]
>([
  [1, [['2n', null, null, null], [null, null, null, null], ['2n', null, null, null], [null, null, null, null]].flat()],
  [2, [['4n', null, null, null], ['4n', null, null, null], ['4n', null, null, null], ['4n', null, null, null]].flat()],
  [3, [['8n', null, '8n', null], ['8n', null, '8n', null], ['8n', null, '8n', null], ['8n', null, '8n', null]].flat()],
  [4, [['16n','16n','16n','16n'], ['16n','16n','16n','16n'], ['16n','16n','16n','16n'], ['16n','16n','16n','16n']].flat()]
]);

export const arpeggio = createChannel({
  key: "arpeggio",
  initialize: () => {
    const gain = new Tone.Gain(1).toDestination();
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine4" },
      volume: -8,
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 4 },
    }).connect(gain);

    return {
      synth,
      rhythmSpeed: 3,
      octave: 3,
      chordNoteIndex: 0,
      direction: "ascending" as "ascending" | "descending",
    };
  },
  onLoop: (
    { key, chordRootScaleDegree, getChord, transport },
    channelState,
    time
  ) => {
    const { synth } = channelState;
    const currentChord = getChord(key, chordRootScaleDegree);
    const chordNotesWithoutOctave = Chord.get(currentChord).notes;
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((i) => {
      transport.schedule((time) => {
        const rhythmVariation = rhythmVariations.get(channelState.rhythmSpeed)!;
        const rhythmAtSixteenthBeat = rhythmVariation[i];
        if (rhythmAtSixteenthBeat) {
          const { octave } = channelState;
          const notes = chordNotesWithoutOctave
            .map((letterWithoutNumber) => letterWithoutNumber + octave)
            .concat(
              chordNotesWithoutOctave[chordNotesWithoutOctave.length - 1] +
                (octave + 1)
            );

          const note = notes[channelState.chordNoteIndex];
          console.log(
            `Arpeggio playing chord note index ${channelState.chordNoteIndex} (${note}) for duration ${rhythmAtSixteenthBeat}`
          );
          synth.triggerAttackRelease(note, rhythmAtSixteenthBeat, time);

          if (channelState.direction === "ascending") {
            if (channelState.chordNoteIndex === notes.length - 1) {
              channelState.direction = "descending";
              channelState.chordNoteIndex -= 1;
            } else {
              channelState.chordNoteIndex += 1;
            }
          } else {
            // descending
            if (channelState.chordNoteIndex === 0) {
              channelState.direction = "ascending";
              channelState.chordNoteIndex += 1;
            } else {
              channelState.chordNoteIndex -= 1;
            }
          }
        }
      }, time + Tone.Time("16n").toSeconds() * i);
    });
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    if (frontToBack < 25) {
      channelState.octave = 4;
    } else if (frontToBack < 50) {
      channelState.octave = 5;
    } else if (frontToBack < 75) {
      channelState.octave = 6;
      channelState.synth.volume.rampTo(-15, 0);
    } else {
      channelState.octave = 7;
      channelState.synth.volume.rampTo(-20, 0);
    }

    // when around is high, faster rhythm.
    // when low, slower.
    if (around <= 24) {
      channelState.rhythmSpeed = 1;
    } else if (around <= 49) {
      channelState.rhythmSpeed = 2;
    } else if (around <= 74) {
      channelState.rhythmSpeed = 3;
    } else {
      channelState.rhythmSpeed = 4;
    }
  },
});
