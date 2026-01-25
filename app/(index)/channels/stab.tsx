import * as Tone from "tone";
import { Scale } from "tonal";
import { defineChannel } from "../Channel";
import { getStabSynth } from "../instruments/getStabSynth";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";
import { Slider } from "../ChannelDisplaySlider";

type ChordEvent = ReturnType<typeof pattern>[number];

type PatternName = keyof typeof patterns;
const patterns = {
  SILENT: [],
  LOW: pattern(["0", "I", "8n"], ["0:2", "I", "8n"]),
  ALTERNATING: pattern(
    ["0", "I", "8n"],
    ["0:1", "IV", "8n"],
    ["0:2", "I", "8n"]
  ),
  HIGH: pattern(["0", "IV", "8n"], ["0:2", "IV", "8n"]),
  "CONSTANT HIGH": pattern(
    ["0", "IV", "8n"],
    ["0:1", "IV", "8n"],
    ["0:2", "IV", "8n"],
    ["0:3", "IV", "8n"]
  ),
} as const satisfies Record<string, ChordEvent[]>;

function getScaleNotes(tonic: string, octave: string, scale: string) {
  return Scale.get(`${tonic}${octave} ${scale}`).notes as Tone.Unit.Note[];
}

function getChordNotes(
  chordType: "I" | "IV",
  tonic: string,
  scale: string
): Tone.Unit.Note[] {
  const scaleNotes = getScaleNotes(tonic, "3", scale);

  if (chordType === "I") {
    // I chord: [1, 3, 5] scale degrees
    return [
      scaleNotes[0] || `${tonic}3`, // 1st degree
      scaleNotes[2] || `${tonic}3`, // 3rd degree
      scaleNotes[4] || `${tonic}3`, // 5th degree
    ];
  } else {
    // IV chord: [4, 6, 1+octave] scale degrees
    const higherScaleNotes = getScaleNotes(tonic, "4", scale);
    return [
      scaleNotes[3] || `${tonic}3`, // 4th degree
      scaleNotes[5] || `${tonic}3`, // 6th degree
      higherScaleNotes[0] || `${tonic}4`, // 1st degree + octave
    ];
  }
}

function getSequenceForPattern(
  patternName: PatternName,
  synth: ReturnType<typeof getStabSynth>,
  tonic: string,
  scale: string
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;
  const part = new Tone.Part<ChordEvent>((time, event) => {
    if (event) {
      const notes = getChordNotes(event.chordType as "I" | "IV", tonic, scale);
      synth.analogSynth.triggerAttackRelease(notes, event.duration, time);
    }
  }, pattern);
  part.loop = true;
  part.loopEnd = "1m";

  return part;
}

export const stab = defineChannel({
  initialize: ({ currentMeasureStartTime, tonic, scale }) => {
    console.log("channels!", "stab initialized!!");
    const synth = getStabSynth();

    const startPattern = "SILENT" as PatternName;
    const sequence = getSequenceForPattern(startPattern, synth, tonic, scale);
    sequence?.start(currentMeasureStartTime);

    return {
      state: {
        pattern: startPattern,
        oscillator: "fatsawtooth8" as const,
        echoWet: 0.7,
        echoFeedback: 0.5,
        oscillatorCount: 2,
        oscillatorSpread: 10,
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
    tonicChange: (controls, state, tone, newTonic) => {
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
    scaleChange: (controls, state, tone, newScale) => {
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
    controls.sequence?.dispose();

    const newSequence = getSequenceForPattern(
      state.pattern,
      controls.synth,
      tonic,
      scale
    );
    newSequence?.start(currentMeasureStartTime);

    controls.sequence = newSequence;

    controls.synth.echo.wet.value = state.echoWet;
    controls.synth.echo.feedback.value = state.echoFeedback;

    controls.synth.analogSynth.set({
      oscillator: {
        type: state.oscillator,
        count: state.oscillatorCount,
        spread: state.oscillatorSpread,
      },
    });
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
              label="Pattern"
              value={state.pattern}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-green-600"
              label="Echo Wet"
              value={state.echoWet.toFixed(2)}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-orange-600"
              label="Echo Feedback"
              value={state.echoFeedback.toFixed(2)}
            />

            <ChannelDisplayItem
              className="flex-1 basis-full [&>.value]:text-purple-600"
              label="Oscillator"
              value={state.oscillator}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-cyan-600"
              label="Osc Count"
              value={`${state.oscillatorCount}`}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-pink-600"
              label="Osc Spread"
              value={`${state.oscillatorSpread}`}
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
                min={0.2}
                max={0.7}
                step={0.01}
                value={state.echoWet}
                onChange={(v) => setState({ ...state, echoWet: v })}
                className="flex-1 slider-green-600"
              />
              <Slider
                min={0.1}
                max={0.9}
                step={0.05}
                value={state.echoFeedback}
                onChange={(v) => setState({ ...state, echoFeedback: v })}
                className="flex-1 slider-orange-600"
              />
            </div>

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

            <div className="flex">
              <Slider
                min={1}
                max={3}
                step={1}
                value={state.oscillatorCount}
                onChange={(v) => setState({ ...state, oscillatorCount: v })}
                className="flex-1 slider-cyan-600"
                notchesCount={8}
              />
              <Slider
                min={1}
                max={50}
                step={1}
                value={state.oscillatorSpread}
                onChange={(v) => setState({ ...state, oscillatorSpread: v })}
                className="flex-1 slider-pink-600"
                notchesCount={10}
              />
            </div>
          </>
        }
      />
    );
  },
});

function pattern(
  ...chords: [
    time: Tone.Unit.Time,
    chordType: "I" | "IV",
    duration: Tone.Unit.Time,
  ][]
) {
  return chords.map(([time, chordType, duration]) => ({
    time,
    chordType,
    duration,
  }));
}
