import * as Tone from "tone";
import { defineChannel } from "../Channel";
import { getStabSynth } from "../synth/getStabSynth";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";

const ebChord: Tone.Unit.Note[] = ["Eb3", "Gb3", "Bb3"];
const abChord: Tone.Unit.Note[] = ["Ab3", "C4", "Eb4"];

type ChordEvent = ReturnType<typeof pattern>[number];

type PatternName = keyof typeof patterns;
const patterns = {
  SILENT: [],
  LOW: pattern(["0", "Eb", "8n"], ["0:2", "Eb", "8n"]),
  ALTERNATING: pattern(
    ["0", "Eb", "8n"],
    ["0:1", "Ab", "8n"],
    ["0:2", "Eb", "8n"]
  ),
  HIGH: pattern(["0", "Ab", "8n"], ["0:2", "Ab", "8n"]),
  "CONSTANT HIGH": pattern(
    ["0", "Ab", "8n"],
    ["0:1", "Ab", "8n"],
    ["0:2", "Ab", "8n"],
    ["0:3", "Ab", "8n"]
  ),
} as const satisfies Record<string, ChordEvent[]>;

function getSequenceForPattern(
  patternName: PatternName,
  synth: ReturnType<typeof getStabSynth>
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;
  const part = new Tone.Part<ChordEvent>((time, event) => {
    if (event) {
      const notes = event.chordType === "Eb" ? ebChord : abChord;
      synth.analogSynth.triggerAttackRelease(notes, event.duration, time);
    }
  }, pattern);
  part.loop = true;
  part.loopEnd = "1m";

  return part;
}

export const stab = defineChannel({
  initialize: ({ currentMeasureStartTime }) => {
    console.log("channels!", "stab initialized!!");
    const synth = getStabSynth();

    const startPattern = "SILENT" as PatternName;
    const sequence = getSequenceForPattern(startPattern, synth);
    sequence?.start(currentMeasureStartTime);

    return {
      state: {
        pattern: startPattern,
        oscillator: "fatsawtooth8" as const,
        echoWet: 0.7,
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
  onStateChange: (
    { currentMeasureStartTime },
    controls,
    state,
    previousState
  ) => {
    if (state.pattern !== previousState.pattern) {
      controls.sequence?.dispose();

      const newSequence = getSequenceForPattern(state.pattern, controls.synth);
      newSequence?.start(currentMeasureStartTime);

      controls.sequence = newSequence;
    }

    if (state.echoWet !== previousState.echoWet) {
      controls.synth.echo.wet.value = state.echoWet;
    }

    if (state.oscillator !== previousState.oscillator) {
      controls.synth.analogSynth.set({
        oscillator: {
          type: state.oscillator,
        },
      });
    }
  },
  renderMonitorDisplay: (state, setState) => {
    const patternNames = Object.keys(patterns) as PatternName[];

    return (
      <ChannelDisplay
        title="Stab"
        className="w-100"
        boxContents={
          <div className="flex flex-row flex-wrap justify-between">
            <ChannelDisplayItem
              className="flex-1 basis-full [&>.value]:text-blue-600"
              label="Echo Wet"
              value={state.pattern}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-green-600"
              label="Echo Wet"
              value={state.echoWet.toFixed(2)}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-purple-600"
              label="Oscillator"
              value={state.oscillator}
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

            <Slider
              min={0.2}
              max={0.7}
              step={0.01}
              value={state.echoWet}
              onChange={(v) => setState({ ...state, echoWet: v })}
              className="w-full slider-green-600"
            />

            <Slider
              min={1}
              max={20}
              step={1}
              value={parseInt(state.oscillator.replace("fatsawtooth", ""))}
              onChange={(value) =>
                setState({
                  ...state,
                  oscillator: `fatsawtooth${value}` as typeof state.oscillator,
                })
              }
              className="w-full rounded-lg appearance-none cursor-pointer slider slider-purple-600"
              notchesCount={20}
            />
          </>
        }
      />
    );
  },
});

function pattern(
  ...chords: [
    time: Tone.Unit.Time,
    chordType: "Ab" | "Eb",
    duration: Tone.Unit.Time,
  ][]
) {
  return chords.map(([time, chordType, duration]) => ({
    time,
    chordType,
    duration,
  }));
}

function Slider({
  className,
  min,
  max,
  step,
  notchesCount = 1,
  value,
  onChange,
}: {
  className?: string;
  min: number;
  max: number;
  step: number;
  notchesCount?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className={`${className} appearance-none slider`}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={
        {
          "--steps-count": notchesCount,
        } as React.CSSProperties
      }
    />
  );
}
