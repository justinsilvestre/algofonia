import * as Tone from "tone";
import { SoundModuleDefinition } from "./SoundModule";

const START_BPM = 100;
const DEFAULT_MASTER_VOLUME = 7.5;

export type ToneEventMap = {
  tonicChange: string;
  scaleChange: string;
  chordRootScaleDegreeChange: number;
  bpmChange: number;

  proximityMapUpdate: Record<string, number>;

  /** * When a vertical column exceeds the threshold,
   * ramp up the specific note volume.
   */
  sliceActive: { index: number; density: number };

  /** * Triggered when the attractor centroid crosses
   * a line connecting two visitors.
   */
  poemTrigger: { pair: number[] };

  /** Continuous update for humming wave evolution */
  entropyUpdate: number;

  /** Continuous update for spatial panning */
  centroidMove: number;

  proximityMelodyChange: undefined;
};

export type ToneEventType = keyof ToneEventMap;
export type ToneEventListenerArg<T extends ToneEventType> = ToneEventMap[T];
type ToneEventListener<T extends ToneEventType> = (
  value: ToneEventMap[T]
) => void;

export type ToneControls = ReturnType<typeof getToneControls>;

/**
 * A noop function to help with type inference when defining sound modules
 * specifically for this app.
 */
export function defineSoundModule<SoundModuleControls, SoundModuleState>(
  definition: SoundModuleDefinition<
    SoundModuleControls,
    SoundModuleState,
    ToneControls,
    ToneEventMap
  >
) {
  return definition;
}

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

  const emit = <T extends ToneEventType>(
    event: T,
    ...[value]: ToneEventMap[T] extends undefined
      ? []
      : [value: ToneEventMap[T]]
  ) => {
    // console.log("Emitting event:", event, value);
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(value));
    }
  };

  Tone.loaded().then(() => {
    // any synths not living within sound modules can be initialized here
  });

  let tonic = "C#";
  let scale = "minor";
  let chordRootScaleDegree = 1;

  return {
    eventListeners,
    emit,
    addEventListener,
    removeEventListener,
    masterVolume: DEFAULT_MASTER_VOLUME,
    get currentMeasureStartTime() {
      const position = Tone.getTransport().position as string;

      const currentBar = position.split(":")[0];

      return Tone.Time(`${currentBar}:0:0`).toSeconds();
    },
    get transport() {
      return Tone.getTransport();
    },
    setBpm: (bpm: number) => {
      if (targetBpm === bpm) return;
      const currentBpm = Tone.getTransport().bpm.value;
      const difference = Math.abs(bpm - currentBpm);
      if (!difference) return;
      const rampTime = difference > 20 ? 1 : difference > 10 ? 0.5 : 0.01;

      console.log(
        `Ramping BPM from ${currentBpm} to ${bpm} over ${rampTime} seconds`
      );
      Tone.getTransport().bpm.rampTo(bpm, rampTime);
      targetBpm = bpm;
      emit("bpmChange", bpm);
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
    /** currently static */
    get chordRootScaleDegree() {
      return chordRootScaleDegree;
    },
    set chordRootScaleDegree(degree: number) {
      if (chordRootScaleDegree !== degree) {
        chordRootScaleDegree = degree;
        emit("chordRootScaleDegreeChange", degree);
      }
    },
  };
}
