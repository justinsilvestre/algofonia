import * as Tone from "tone";
import { Scale } from "tonal";
import { defineSoundModule } from "../tone";
import { get303Synth } from "../instruments/get303Synth";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";
import { Slider } from "../SoundModuleDisplaySlider";

// Classic 303 acid patterns
type SequenceStep = {
  note?: string;
  accent?: boolean;
  slide?: boolean;
  time: Tone.Unit.Time;
  duration: Tone.Unit.Time;
};

type PatternName = keyof typeof patterns;

// Define classic 303-style patterns
const patterns = {
  SILENT: [],
  CLASSIC_ACID: [
    { note: "C2", accent: true, time: "0:0", duration: "8n" },
    { note: "C3", time: "0:1", duration: "8n" },
    { note: "G2", accent: true, time: "0:2", duration: "8n" },
    { time: "0:3", duration: "8n" }, // Rest
    { note: "F2", time: "1:0", duration: "8n" },
    { note: "C3", accent: true, time: "1:1", duration: "8n" },
    { note: "C2", time: "1:2", duration: "8n" },
    { note: "G2", time: "1:3", duration: "8n" },
  ],
  SQUELCHY: [
    { note: "C2", accent: true, time: "0:0", duration: "16n" },
    { note: "C3", accent: true, time: "0:0:2", duration: "16n" },
    { note: "G2", time: "0:1", duration: "8n" },
    { note: "F2", accent: true, time: "0:2", duration: "8n" },
    { time: "0:3", duration: "8n" }, // Rest
    { note: "C2", time: "1:0", duration: "8n" },
    { note: "G2", accent: true, time: "1:1", duration: "16n" },
    { note: "C3", time: "1:1:2", duration: "16n" },
    { note: "F2", time: "1:2", duration: "8n" },
    { note: "C2", accent: true, time: "1:3", duration: "8n" },
  ],
  ROLLING_BASS: [
    { note: "C1", accent: true, time: "0:0", duration: "8n" },
    { note: "C2", time: "0:1", duration: "16n" },
    { note: "C1", time: "0:1:2", duration: "16n" },
    { note: "G1", accent: true, time: "0:2", duration: "8n" },
    { note: "F1", time: "0:3", duration: "8n" },
    { note: "C1", time: "1:0", duration: "8n" },
    { note: "G1", time: "1:1", duration: "8n" },
    { note: "C2", accent: true, time: "1:2", duration: "8n" },
    { note: "F1", time: "1:3", duration: "8n" },
  ],
  MINIMAL: [
    { note: "C2", accent: true, time: "0:0", duration: "4n" },
    { note: "G2", time: "0:2", duration: "4n" },
    { note: "F2", time: "1:0", duration: "4n" },
    { note: "C3", accent: true, time: "1:2", duration: "4n" },
  ],
} as const satisfies Record<string, SequenceStep[]>;

function getScaleNotes(tonic: string, octave: string, scale: string) {
  return Scale.get(`${tonic}${octave} ${scale}`).notes as Tone.Unit.Note[];
}

function transposeNoteToScale(
  note: string,
  tonic: string,
  scale: string
): string {
  // Simple transposition - map root note to tonic
  const noteBase = note.replace(/\d+/, ""); // Remove octave
  const octave = note.replace(/[A-G#b]+/, ""); // Extract octave

  const scaleNotes = getScaleNotes(tonic, octave, scale);

  // Map basic note to scale degree
  const noteMap: Record<string, number> = {
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4,
    A: 5,
    B: 6,
  };

  const baseDegree = noteMap[noteBase] || 0;
  const transposedNote = scaleNotes[baseDegree % scaleNotes.length];

  return transposedNote || note; // Fallback to original note
}

function getSequenceForPattern(
  patternName: PatternName,
  synth: ReturnType<typeof get303Synth>,
  tonic: string,
  scale: string
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;

  const part = new Tone.Part<SequenceStep>((time, step) => {
    if (step && step.note) {
      const transposedNote = transposeNoteToScale(step.note, tonic, scale);
      synth.triggerAttackRelease(
        transposedNote,
        step.duration,
        time,
        1.0,
        step.accent || false
      );
    }
  }, pattern);

  part.loop = true;
  part.loopEnd = "2m"; // 2 measure loop

  return part;
}

export const acid303 = defineSoundModule({
  initialize: ({ currentMeasureStartTime, tonic, scale }) => {
    console.log("soundModules!", "303 acid initialized!!");
    const synth = get303Synth();

    const startPattern = "SILENT" as PatternName;
    const sequence = getSequenceForPattern(startPattern, synth, tonic, scale);
    sequence?.start(currentMeasureStartTime);

    return {
      state: {
        pattern: startPattern,
        cutoff: 800,
        resonance: 10,
        envMod: 0.3,
        accent: 0.8,
        decay: 0.3,
        distortion: 0.2,
        delayWet: 0.2,
        delayFeedback: 0.3,
        volume: 0.5, // Lower default volume
      },
      controls: {
        sequence,
        synth,
      },
    };
  },
  teardown: ({ synth, sequence }) => {
    synth.dispose();
    sequence?.dispose();
  },
  onToneEvent: {
    tonicChange: (controls, state, tone, newTonic, _setState) => {
      controls.sequence?.dispose();

      const newSequence = getSequenceForPattern(
        state.pattern,
        controls.synth,
        newTonic,
        tone.scale
      );
      newSequence?.start(tone.currentMeasureStartTime);

      controls.sequence = newSequence;
    },
    scaleChange: (controls, state, tone, newScale, _setState) => {
      controls.sequence?.dispose();

      const newSequence = getSequenceForPattern(
        state.pattern,
        controls.synth,
        tone.tonic,
        newScale
      );
      newSequence?.start(tone.currentMeasureStartTime);

      controls.sequence = newSequence;
    },
  },
  onStateChange: (
    { currentMeasureStartTime, tonic, scale },
    controls,
    state,
    previousState
  ) => {
    // Update pattern if changed
    if (previousState.pattern !== state.pattern) {
      controls.sequence?.dispose();

      const newSequence = getSequenceForPattern(
        state.pattern,
        controls.synth,
        tonic,
        scale
      );
      newSequence?.start(currentMeasureStartTime);

      controls.sequence = newSequence;
    }

    // Update synth parameters
    controls.synth.setCutoffFrequency(state.cutoff);
    controls.synth.filter.Q.value = state.resonance;
    controls.synth.filterEnvelope.decay = state.decay;
    controls.synth.distortion.distortion = state.distortion;
    controls.synth.delay.wet.value = state.delayWet;
    controls.synth.delay.feedback.value = state.delayFeedback;
    controls.synth.envModAmount.value = state.envMod * 2000; // Reduced scaling for more cutoff control
    controls.synth.outputVolume.gain.value = state.volume;
  },
  renderMonitorDisplay: (state, setState) => {
    const patternNames = Object.keys(patterns) as PatternName[];

    return (
      <SoundModuleDisplay
        title="303 Acid"
        className="w-100"
        boxContents={
          <div className="flex flex-row flex-wrap justify-between">
            <SoundModuleDisplayItem
              className="flex-1 basis-full [&>.value]:text-blue-600"
              label="Pattern"
              value={state.pattern}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-green-400"
              label="Cutoff"
              value={`${Math.round(state.cutoff)}Hz`}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-red-400"
              label="Resonance"
              value={state.resonance.toFixed(1)}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-blue-400"
              label="Env Mod"
              value={state.envMod.toFixed(2)}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-purple-400"
              label="Decay"
              value={`${state.decay.toFixed(2)}s`}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-orange-400"
              label="Distortion"
              value={state.distortion.toFixed(2)}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-cyan-400"
              label="Delay"
              value={state.delayWet.toFixed(2)}
            />

            <SoundModuleDisplayItem
              className="flex-1 basis-1/2 [&>.value]:text-yellow-400"
              label="Volume"
              value={state.volume.toFixed(2)}
            />
          </div>
        }
        bottom={
          <>
            <Slider
              min={0}
              max={patternNames.length - 1}
              step={1}
              value={patternNames.indexOf(state.pattern)}
              onChange={(value) =>
                setState({
                  ...state,
                  pattern: patternNames[value],
                })
              }
              className="w-full slider-blue-600"
              notchesCount={patternNames.length}
            />

            <div className="flex">
              <Slider
                min={100}
                max={8000}
                step={50}
                value={state.cutoff}
                onChange={(value) => setState({ ...state, cutoff: value })}
                className="flex-1 slider-green-400"
              />
              <Slider
                min={0.5}
                max={30}
                step={0.5}
                value={state.resonance}
                onChange={(value) => setState({ ...state, resonance: value })}
                className="flex-1 slider-red-400"
              />
            </div>

            <div className="flex">
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={state.envMod}
                onChange={(value) => setState({ ...state, envMod: value })}
                className="flex-1 slider-blue-400"
              />
              <Slider
                min={0.01}
                max={2}
                step={0.01}
                value={state.decay}
                onChange={(value) => setState({ ...state, decay: value })}
                className="flex-1 slider-purple-400"
              />
            </div>

            <div className="flex">
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={state.distortion}
                onChange={(value) => setState({ ...state, distortion: value })}
                className="flex-1 slider-orange-400"
              />
              <Slider
                min={0}
                max={0.8}
                step={0.01}
                value={state.delayWet}
                onChange={(value) => setState({ ...state, delayWet: value })}
                className="flex-1 slider-cyan-400"
              />
            </div>

            <div className="flex">
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={state.volume}
                onChange={(value) => setState({ ...state, volume: value })}
                className="flex-1 slider-yellow-400"
              />
            </div>
          </>
        }
      />
    );
  },
});
