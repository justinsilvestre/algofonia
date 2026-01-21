import * as Tone from "tone";
import { createChannel } from "../tone";
import { getStabSynth } from "../synth/getStabSynth";

// front-to-back:
// simultaneously with echo
//   level 1: silence
//   level 2: low chord every other beat
//   level 3: low-high-low
//   level 4: high chord every other beat
//   level 5: high chord every beat
// around:
//   cycles through oscillators

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

export const stab = createChannel({
  key: "Stab",
  initialize: ({ currentMeasureStartTime }) => {
    console.log("channels!", "stab initialized!!");
    const synth = getStabSynth();

    const startPattern = "SILENT" as PatternName;
    const sequence = getSequenceForPattern(startPattern, synth);
    sequence?.start(currentMeasureStartTime);

    return {
      sequence,
      synth,
      pattern: startPattern,
      oscillator: "fatsawtooth8",
      echoWet: 0.7,
    };
  },
  teardown: ({ synth, sequence }) => {
    synth.dispose();
    sequence?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { sequence, pattern, synth } = getState();

    const updateSequence = (newPattern: PatternName) => {
      if (newPattern === pattern) return;

      if (sequence) sequence.dispose();

      const newSequence = getSequenceForPattern(newPattern, synth);
      setState((state) => ({
        ...state,
        pattern: newPattern,
        sequence: newSequence,
      }));
      newSequence?.start(currentMeasureStartTime);
    };

    if (frontToBack < 15) {
      updateSequence("SILENT");
    } else if (frontToBack < 40) {
      updateSequence("LOW");
    } else if (frontToBack < 60) {
      updateSequence("ALTERNATING");
    } else if (frontToBack < 95) {
      updateSequence("HIGH");
    } else {
      updateSequence("CONSTANT HIGH");
    }

    // from 0.2 to 0.7
    const echoWet = 0.2 + (frontToBack / 100) * 0.5;
    // from 1 to 20
    const fatSawtoothIndex = Math.floor((around / 100) * 19) + 1;
    const oscillatorType = `fatsawtooth${fatSawtoothIndex}` as "fatsawtooth1";
    // // from .4 to .8
    // synth.echo.feedback.value = 0.4 + (frontToBack / 100) * 0.4;

    synth.echo.wet.value = echoWet;
    synth.analogSynth.set({
      oscillator: {
        type: oscillatorType,
      },
    });
    setState((state) => ({
      ...state,
      oscillator: oscillatorType,
      echoWet,
    }));
  },
  renderMonitorDisplay: (channelState) => {
    const feedback = channelState.synth.echo.feedback.value;
    const echoWet = channelState.echoWet;

    return (
      <div className="flex-1 text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Echo Feedback</span>
            <span className="font-mono text-base text-purple-400">
              {feedback.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Echo Wet</span>
            <span className="font-mono text-base text-purple-400">
              {echoWet.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Oscillator</span>
            <span className="font-mono text-base text-yellow-400">
              {channelState.oscillator}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Pattern</span>
            <span className="font-mono text-base text-green-400">
              {channelState.pattern}
            </span>
          </div>
        </div>
      </div>
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
