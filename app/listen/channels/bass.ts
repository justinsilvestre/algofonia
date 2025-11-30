import * as Tone from "tone";
import { Chord, Key, Scale } from "tonal";
import { createChannel } from "../tone";
import { RecursivePartial } from "tone/build/esm/core/util/Interface";

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

// prettier-ignore
const rhythmVariations = new Map([
  [1, [['2n', null, null, null], [null, null, null, null], ['2n', null, null, null], [null, null, null, null]].flat()],
  [2, [['4n', null, null, null], ['8n', null, '8n', null], ['4n', null, null, null], ['4n', null, null, null]].flat()],
  [3, [['4n', null, null, null], ['8n', null, '8n', null], ['8n', null, '8n', null], ['4n', null, null, null]].flat()],
  [4, [['8n', null, '8n', null], ['16n', '16n', '8n', null], ['16n','16n','16n','16n'], ['8n', null, '8n', null]].flat()],
])

export const bass = createChannel({
  key: "bass",
  initialize: () => {
    console.log("All scale names", Scale.names());

    const gain = new Tone.Gain(1).toDestination();
    const synthSettings: RecursivePartial<Tone.SynthOptions> = {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.8, sustain: 0.6, release: 2.5 },
    };
    const synth = new Tone.Synth(synthSettings).connect(gain);

    return {
      synth,
      gain,
      rhythmSpeed: 1,
    };
  },
  onLoop: (
    { transport, key, chordRootScaleDegree, getChord },
    channelState,
    time
  ) => {
    const { synth } = channelState;
    const currentChord = getChord(key, chordRootScaleDegree);
    const notes = Chord.get(currentChord).notes.map(
      (letterWithoutNumber) => letterWithoutNumber + "3"
    );
    console.log("Current chord:", currentChord, "notes:", notes);

    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((i) => {
      transport.schedule((time) => {
        // get random note from chord
        const note = notes[Math.floor(Math.random() * notes.length)];
        const rhythmVariation = rhythmVariations.get(channelState.rhythmSpeed)!;
        const rhythmAtSixteenthBeat = rhythmVariation[i];
        if (rhythmAtSixteenthBeat)
          console.log(
            `Playing bass note ${note} at sixteenth beat ${i}, rhythm: ${rhythmAtSixteenthBeat}`
          );
        if (rhythmAtSixteenthBeat)
          synth.triggerAttackRelease(note, rhythmAtSixteenthBeat, time);
      }, time + Tone.Time("16n").toSeconds() * i);
    });
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    // when frontToBack is high, progress.
    // when low, resolve.
    if (frontToBack > 50) {
      tone.chordRootScaleDegree = forwardProgression.get(
        tone.chordRootScaleDegree
      )!;
    } else {
      tone.chordRootScaleDegree = resolution.get(tone.chordRootScaleDegree)!;
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
