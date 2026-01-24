import * as Tone from "tone";
import { Key } from "tonal";

const START_BPM = 100;

export type ToneControls = ReturnType<typeof getToneControls>;

export function getToneControls(startBpm: number = START_BPM) {
  let targetBpm = startBpm;
  let blipSynth: Tone.MembraneSynth;

  Tone.loaded().then(() => {
    blipSynth = getBlipSynth();
    blipSynth.toDestination();
  });

  let key = "C";
  let mode = "minor";
  let chordRootScaleDegree = 1;

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
    get key() {
      return key;
    },
    set key(newKey: string) {
      key = newKey;
    },
    get mode() {
      return mode;
    },
    set mode(newMode: string) {
      mode = newMode;
    },
    get chordRootScaleDegree() {
      return chordRootScaleDegree;
    },
    set chordRootScaleDegree(degree: number) {
      chordRootScaleDegree = degree;
    },
    getChord: (key: string, chordRootScaleDegree: number) => {
      return Key.majorKey(key).chords[chordRootScaleDegree - 1];
    },
    blip() {
      blipSynth.triggerAttackRelease("C6", "8n");
    },
  };
}

function getBlipSynth() {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0.01,
      release: 1.4,
      attackCurve: "exponential",
    },
  });

  return synth;
}
