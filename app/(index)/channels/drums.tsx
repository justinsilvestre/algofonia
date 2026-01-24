import * as Tone from "tone";
import { defineChannel } from "../Channel";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";

type DrumEvent = "K" | "S" | "KS" | null | DrumEvent[];
type PatternName = keyof typeof patterns;

const patterns = {
  SILENT: [],
  TWO_STEP_KICK: ["K", null, [null, "K"], null],
  TWO_STEP_KICK_AND_SNARE: ["K", "S", [null, "K"], "S"],
  FOUR_ON_FLOOR: ["K", "KS", "K", "KS"],
  ADDED_SYNCOPATION: [["K", null, null, "K"], "KS", ["K", "K"], "KS"],
} as const satisfies Record<string, DrumEvent[]>;

export const drums = defineChannel({
  initialize: ({ currentMeasureStartTime }) => {
    const initialPattern = "SILENT" as PatternName;
    const kick = get909KickSynth();
    const snare = getSnareSynth();
    const sequence = getSequenceForPattern(initialPattern, kick, snare);
    sequence?.start(currentMeasureStartTime);

    return {
      state: { pattern: initialPattern },
      controls: {
        kick,
        snare,
        sequence,
      },
    };
  },
  teardown: ({ kick, snare, sequence }) => {
    sequence?.dispose();
    kick.dispose();
    snare.dispose();
  },
  onStateChange: (
    { currentMeasureStartTime },
    controls,
    state,
    previousState
  ) => {
    if (state.pattern !== previousState.pattern) {
      controls.sequence?.dispose();

      const newSequence = getSequenceForPattern(
        state.pattern,
        controls.kick,
        controls.snare
      );
      newSequence?.start(currentMeasureStartTime);

      controls.sequence = newSequence;
    }
  },
  renderMonitorDisplay: (state, setState) => {
    const patternNames = Object.keys(patterns) as PatternName[];

    return (
      <ChannelDisplay
        title="Drums"
        className="w-100"
        boxContents={
          <ChannelDisplayItem
            className="[&>.value]:text-blue-600"
            label="Pattern"
            value={state.pattern}
          />
        }
        bottom={
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
        }
      />
    );
  },
}); /**
 * Creates a TR-909 inspired Kick Drum using Tone.js
 */

function get909KickSynth() {
  // 1. The Body: MembraneSynth handles the pitch envelope (the "oomph")
  const oscillator = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    // octaves: 10,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.4,
      sustain: 0.01,
      release: 1.4,
    },
  });

  // 2. The Attack: NoiseSynth provides the initial "click"
  const click = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.005,
      sustain: 0,
    },
  });

  // 3. Shaping: A low-pass filter to glue them together and remove harsh noise
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: 800,
    rolloff: -12,
  });

  const output = new Tone.Gain(1).toDestination();

  // Signal Chain: [Osc/Click] -> [Filter] -> [Output]
  oscillator.connect(filter);
  click.connect(filter);
  filter.connect(output);

  return {
    dispose: () => {
      oscillator.dispose();
      click.dispose();
      filter.dispose();
      output.dispose();
    },
    /**
     * Triggers the hit at a specific transport time
     */
    hit: (time: Tone.Unit.Time = Tone.now()) => {
      // 909 kicks usually sit around G1 (approx 49Hz)
      oscillator.triggerAttackRelease("G1", "8n", time);
      click.triggerAttackRelease(time);
    },
  };
}

function getSnareSynth() {
  const synth = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: {
      attack: 0.001,
      decay: 0.18,
      sustain: 0.05,
    },
  })
    .connect(new Tone.Filter(2200, "highpass"))
    .toDestination();

  return {
    synth,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    dispose: () => {
      synth.dispose();
    },
  };
}

function getSequenceForPattern(
  patternName: PatternName,
  kick: ReturnType<typeof get909KickSynth>,
  snare: ReturnType<typeof getSnareSynth>
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;
  return new Tone.Sequence<DrumEvent>(
    (time, event) => {
      if (event === "K") {
        kick.hit(time);
      } else if (event === "S") {
        snare.hit(time);
      } else if (event === "KS") {
        kick.hit(time);
        snare.hit(time);
      }
    },
    pattern,
    "4n"
  );
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
