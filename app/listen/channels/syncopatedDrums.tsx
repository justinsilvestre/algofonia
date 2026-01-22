import * as Tone from "tone";
import { createChannel } from "../tone";

type DrumEvent = "XX" | null | DrumEvent[];
type ClapPatternName = keyof typeof clapPatterns;
type TomPatternName = keyof typeof tomPatterns;

const clapPatterns = {
  SILENT: [],
  SINGLE: [
    [null, null, null, "XX"],
    [null, null, "XX", null],
    [null, null, null, "XX"],
    [null, null, "XX", null],
  ],
  DOUBLE: [
    [null, "XX", null, "XX"],
    ["XX", null, "XX", null],
    ["XX", null, null, "XX"],
    [null, "XX", null, "XX"],
  ],
} as const satisfies Record<string, DrumEvent[]>;

const tomPatterns = {
  SILENT: [],
  SINGLE: [
    [null, "XX", null, null],
    [null, null, "XX", null],
    [null, null, null, "XX"],
    [null, null, "XX", null],
  ],
  DOUBLE: [
    [null, "XX", null, "XX"],
    ["XX", null, "XX", null],
    [null, "XX", null, "XX"],
    ["XX", null, "XX", null],
  ],
} as const satisfies Record<string, DrumEvent[]>;

function getPart(
  pattern: DrumEvent[],
  synth: { hit: (time: Tone.Unit.Time) => void }
) {
  if (!pattern.length) return null;

  const part = new Tone.Sequence<DrumEvent>(
    (time) => synth.hit(time),
    pattern,
    "4n"
  );

  return part;
}

export const syncopatedDrums = createChannel({
  key: "Syncopated drums",
  initialize: ({ currentMeasureStartTime }) => {
    const clapSynth = getClapSynth();
    const lowTomSynth = getLowTomSynth();

    const startClapPattern = "SILENT" as ClapPatternName;
    const startTomPattern = "SILENT" as TomPatternName;

    const clapPart = getPart(clapPatterns[startClapPattern], clapSynth);
    const tomPart = getPart(tomPatterns[startTomPattern], lowTomSynth);
    clapPart?.start(currentMeasureStartTime);
    tomPart?.start(currentMeasureStartTime);

    return {
      clapSynth,
      lowTomSynth,
      clapPattern: startClapPattern,
      tomPattern: startTomPattern,

      clapPart,
      tomPart,
    };
  },
  teardown: ({ clapSynth, lowTomSynth, clapPart, tomPart }) => {
    clapSynth.dispose();
    lowTomSynth.dispose();
    clapPart?.dispose();
    tomPart?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const {
      clapPart,
      tomPart,
      clapPattern,
      tomPattern,
      clapSynth,
      lowTomSynth,
    } = getState();

    let newClapPattern: "SILENT" | "SINGLE" | "DOUBLE";
    let newTomPattern: "SILENT" | "SINGLE" | "DOUBLE";

    if (frontToBack < 33) {
      newClapPattern = "SILENT";
    } else if (frontToBack < 66) {
      newClapPattern = "SINGLE";
    } else {
      newClapPattern = "DOUBLE";
    }

    if (around < 33) {
      newTomPattern = "SILENT";
    } else if (around < 66) {
      newTomPattern = "SINGLE";
    } else {
      newTomPattern = "DOUBLE";
    }

    if (newClapPattern !== clapPattern) {
      clapPart?.dispose();
      const newClapPart = getPart(clapPatterns[newClapPattern], clapSynth);
      newClapPart?.start(currentMeasureStartTime);
      setState((state) => ({
        ...state,
        clapPattern: newClapPattern,
        clapPart: newClapPart,
      }));
    }

    if (newTomPattern !== tomPattern) {
      tomPart?.dispose();
      const newTomPart = getPart(tomPatterns[newTomPattern], lowTomSynth);
      newTomPart?.start(currentMeasureStartTime);
      setState((state) => ({
        ...state,
        tomPattern: newTomPattern,
        tomPart: newTomPart,
      }));
    }
  },
  renderMonitorDisplay: (channelState) => {
    return (
      <div className="text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600 flex-1">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Clap Pattern</span>
              <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
                {channelState.clapPattern}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Tom Pattern</span>
              <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
                {channelState.tomPattern}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});

function getClapSynth() {
  const volume = -15;
  const clapFilter = new Tone.Filter({
    type: "highpass",
    frequency: 1200,
    Q: 0.7,
  }).toDestination();

  const burstSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.0005,
      decay: 0.015,
      sustain: 0,
    },
  }).connect(clapFilter);
  burstSynth.volume.value = volume;

  const tailSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.002,
      decay: 0.25,
      sustain: 0,
    },
  }).connect(clapFilter);
  tailSynth.volume.value = volume;

  return {
    burstSynth,
    tailSynth,
    dispose: () => {
      burstSynth.dispose();
      tailSynth.dispose();
    },
    hit: (time: Tone.Unit.Time) => {
      // rapid burst cluster (the “hands”)
      const timeSeconds = Tone.Time(time).toSeconds();
      burstSynth.triggerAttackRelease("64n", timeSeconds);
      burstSynth.triggerAttackRelease("64n", timeSeconds + 0.012);
      burstSynth.triggerAttackRelease("64n", timeSeconds + 0.024);

      // diffuse noise tail
      tailSynth.triggerAttackRelease("8n", timeSeconds + 0.03);
    },
  };
}

function getLowTomSynth() {
  // Create a more tom-like sound with proper frequency range
  const fundamentalSynth = new Tone.Synth({
    oscillator: { type: "triangle" }, // More harmonically rich than sine
    envelope: {
      attack: 0.001, // Much faster attack for punch
      decay: 0.6,
      sustain: 0,
      release: 0.05,
    },
  });

  // Add a sub component for body
  const subSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.0005, // Even faster attack for sub punch
      decay: 0.4,
      sustain: 0,
      release: 0.02,
    },
  });

  // Tom-appropriate filtering - higher cutoff for clarity
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: 800, // Higher cutoff for tom clarity
    Q: 1.5, // Less resonance
  });

  // Light saturation for warmth without muddiness
  const distortion = new Tone.Distortion({
    distortion: 0.1, // Much lighter distortion
    oversample: "2x",
  });

  // Chain: fundamental -> filter -> distortion -> destination
  // Sub goes through same chain for consistency
  fundamentalSynth.chain(filter, distortion, Tone.getDestination());
  subSynth.connect(filter);

  const baseVolume = 3;
  fundamentalSynth.volume.value = baseVolume;
  subSynth.volume.value = baseVolume - 6; // Sub is quieter

  return {
    synth: fundamentalSynth, // Keep for compatibility
    subSynth,
    dispose: () => {
      fundamentalSynth.dispose();
      subSynth.dispose();
      filter.dispose();
      distortion.dispose();
    },
    hit: (time: Tone.Unit.Time = Tone.now()) => {
      const timeSeconds = Tone.Time(time).toSeconds();
      const highTone = "F3"; // Fundamental tom pitch
      const lowTone = "F2"; // Sub an octave lower

      // Trigger both synths at tom-appropriate pitch
      fundamentalSynth.triggerAttack(highTone, time); // Higher fundamental for tom
      subSynth.triggerAttack(lowTone, time); // Sub an octave lower

      // Tom-like pitch bend - more subtle than kick
      fundamentalSynth.frequency.setValueAtTime(175, time); // Start at F3
      fundamentalSynth.frequency.exponentialRampToValueAtTime(
        120,
        timeSeconds + 0.12
      ); // Moderate dip, tom-like duration

      // Sub has a very subtle dip
      subSynth.frequency.setValueAtTime(87, time);
      subSynth.frequency.exponentialRampToValueAtTime(80, timeSeconds + 0.08);

      // Release both with tom-like timing
      fundamentalSynth.triggerRelease(timeSeconds + 0.6);
      subSynth.triggerRelease(timeSeconds + 0.4);
    },
    setVolume: (volume: number) => {
      fundamentalSynth.volume.value = volume;
      subSynth.volume.value = volume - 6; // Keep sub quieter
    },
  };
}
