import * as Tone from "tone";
import { Key } from "tonal";

const START_BPM = 100;

export type ToneControls = ReturnType<typeof getToneControls>;

export function getToneControls(startBpm: number = START_BPM) {
  let targetBpm = startBpm;
  return {
    get currentMeasureStartTime() {
      const position = Tone.getTransport().position as string;

      const currentBar = position.split(":")[0];

      return Tone.Time(`${currentBar}:0:0`).toSeconds();
    },
    get transport() {
      return Tone.getTransport();
    },
    setBpm: (bpm: number) => {
      const currentBpm = Tone.getTransport().bpm.value;
      const difference = Math.abs(bpm - currentBpm);
      if (!difference) return;
      const rampTime = difference > 20 ? 1 : difference > 10 ? 0.5 : 0.01;

      console.log(
        `Ramping BPM from ${currentBpm} to ${bpm} over ${rampTime} seconds`
      );
      Tone.getTransport().bpm.rampTo(bpm, rampTime);
      targetBpm = bpm;
    },
    /** The current bpm OR the BPM that has been set as the target for ramping */
    getTargetBpm: () => targetBpm,
    /** Gets current bpm, which may be in the process of ramping to the target bpm */
    getBpm: () => {
      const transport = Tone.getTransport();

      return transport?.bpm?.value ?? startBpm;
    },
    key: "C",
    mode: "minor",
    chordRootScaleDegree: 1,
    getChord: (key: string, chordRootScaleDegree: number) => {
      return Key.majorKey(key).chords[chordRootScaleDegree - 1];
    },
  };
}
