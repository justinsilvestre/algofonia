import * as Tone from "tone";
import { Scale } from "tonal";

const START_BPM = 100;

export type ToneEventMap = {
  tonicChange: string;
  scaleChange: string;
  chordRootScaleDegreeChange: number;
};

export type ToneEventType = keyof ToneEventMap;
export type ToneEventListenerArg<T extends ToneEventType> = ToneEventMap[T];
type ToneEventListener<T extends ToneEventType> = (
  value: ToneEventMap[T]
) => void;

export type ToneControls = ReturnType<typeof getToneControls>;

export function getToneControls(startBpm: number = START_BPM) {
  let targetBpm = startBpm;
  let blipSynth: Tone.MembraneSynth;

  const eventListeners = new Map<
    ToneEventType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Set<ToneEventListener<any>>
  >();

  const addEventListener = <T extends ToneEventType>(
    event: T,
    listener: ToneEventListener<T>
  ) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(listener as ToneEventListener<T>);
  };

  const removeEventListener = <T extends ToneEventType>(
    event: T,
    listener: ToneEventListener<T>
  ) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as ToneEventListener<T>);
    }
  };

  const emit = <T extends ToneEventType>(event: T, value: ToneEventMap[T]) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(value));
    }
  };

  Tone.loaded().then(() => {
    blipSynth = getBlipSynth();
    blipSynth.toDestination();
  });

  let tonic = "D#";
  let scale = "minor";
  let chordRootScaleDegree = 1;

  let lastBlipScaleDegree = 1;
  let lastBlipOctave = 3;

  return {
    eventListeners,
    addEventListener,
    removeEventListener,
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
    get tonic() {
      return tonic;
    },
    set tonic(newTonic: string) {
      if (tonic !== newTonic) {
        tonic = newTonic;
        emit("tonicChange", newTonic);
      }
    },
    get scale() {
      return scale;
    },
    set scale(newScale: string) {
      if (scale !== newScale) {
        scale = newScale;
        emit("scaleChange", newScale);
      }
    },
    get chordRootScaleDegree() {
      return chordRootScaleDegree;
    },
    set chordRootScaleDegree(degree: number) {
      if (chordRootScaleDegree !== degree) {
        chordRootScaleDegree = degree;
        emit("chordRootScaleDegreeChange", degree);
      }
    },
    blip() {
      const octaveDelta = getLowerDelta();
      const octave = clamp(lastBlipOctave + octaveDelta, 3, 7);
      lastBlipOctave = octave;
      const scaleNotes = Scale.get(`${tonic}${octave} ${scale}`).notes;
      const noteDelta = getLowDelta();
      const blipScaleDegree =
        Math.random() < 0.25
          ? 1
          : clamp(lastBlipScaleDegree + noteDelta, 1, scaleNotes.length);
      lastBlipScaleDegree = blipScaleDegree;
      const note = scaleNotes[blipScaleDegree - 1] || scaleNotes[0];
      blipSynth.triggerAttackRelease(note, Math.random());
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
      attack: 0.01,
      decay: 0.2,
      sustain: 0.01,
      release: 1.4,
      attackCurve: "exponential",
    },
  });

  return synth;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Return -2 to 2, with a bias towards smaller intervals */
function getLowDelta() {
  const rand = Math.random();
  if (rand < 0.4) return 0;
  if (rand < 0.65) return Math.random() < 0.5 ? -1 : 1;
  if (rand < 0.8) return Math.random() < 0.5 ? -2 : 2;
  return Math.random() < 0.5 ? -3 : 3;
}

/** Return -2 to 2, with a greater bias towards smaller intervals */
function getLowerDelta() {
  const rand = Math.random();
  if (rand < 0.6) return 0;
  if (rand < 0.85) return Math.random() < 0.5 ? -1 : 1;
  if (rand < 0.95) return Math.random() < 0.5 ? -2 : 2;
  return Math.random() < 0.5 ? -3 : 3;
}
