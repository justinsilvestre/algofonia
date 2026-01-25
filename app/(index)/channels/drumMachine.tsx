import * as Tone from "tone";
import * as React from "react";
import { defineChannel } from "../Channel";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";
import { Slider } from "../ChannelDisplaySlider";
import { get909KickSynth } from "../instruments/get909KickSynth";
import { getSnareSynth } from "../instruments/getSnareSynth";
import { getLowTomSynth } from "@/app/(index)/instruments/getLowTomSynth";

type InstrumentType = "kick" | "hat" | "tom" | "snare";
type StepPattern = Record<InstrumentType, boolean[]>;

const instruments: InstrumentType[] = ["kick", "hat", "tom", "snare"];

export const drumMachine = defineChannel({
  initialize: ({ currentMeasureStartTime }) => {
    const kick = get909KickSynth();
    const hat = getHatSynth();
    const tom = getLowTomSynth();
    const snare = getSnareSynth();

    const initialPatternLength = 16;
    const initialPattern = getEmptyPattern(initialPatternLength);

    const sequence = createSequence(
      initialPattern,
      { kick, hat, tom, snare },
      initialPatternLength,
      0.0
    );
    sequence.start(currentMeasureStartTime);

    return {
      state: {
        pattern: initialPattern,
        patternLength: initialPatternLength,
        isPlaying: true,
        density: 0.3,
        deviation: 0.0,
      },
      controls: {
        kick,
        hat,
        tom,
        snare,
        sequence,
      },
    };
  },

  teardown: ({ kick, hat, tom, snare, sequence }) => {
    sequence.dispose();
    kick.dispose();
    hat.dispose();
    tom.dispose();
    snare.dispose();
  },

  onStateChange: (
    { currentMeasureStartTime },
    controls,
    state,
    previousState
  ) => {
    // Update sequence when pattern changes or length changes
    if (
      JSON.stringify(state.pattern) !== JSON.stringify(previousState.pattern) ||
      state.patternLength !== previousState.patternLength ||
      state.deviation !== previousState.deviation
    ) {
      controls.sequence.dispose();
      const newSequence = createSequence(
        state.pattern,
        {
          kick: controls.kick,
          hat: controls.hat,
          tom: controls.tom,
          snare: controls.snare,
        },
        state.patternLength,
        state.deviation
      );
      newSequence.start(currentMeasureStartTime);
      controls.sequence = newSequence;
    }
  },

  renderMonitorDisplay: (state, setState) => {
    return (
      <ChannelDisplay
        title="Drum Machine"
        className="w-150"
        boxContents={
          <div className="flex flex-col gap-3">
            <div
              className="gap-2 w-fit mx-auto"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${state.patternLength}, minmax(0, 1fr))`,
              }}
            >
              {instruments.map((instrument, instrumentIndex) =>
                state.pattern[instrument].map((isActive, stepIndex) => (
                  <button
                    key={`${instrument}-${stepIndex}`}
                    data-step={stepIndex}
                    data-instrument={instrument}
                    title={
                      instrument.charAt(0).toUpperCase() + instrument.slice(1)
                    }
                    onClick={() =>
                      setState({
                        ...state,
                        pattern: {
                          ...state.pattern,
                          [instrument]: state.pattern[instrument].map(
                            (step, index) =>
                              index === stepIndex ? !step : step
                          ),
                        },
                      })
                    }
                    className={`
                      w-8 h-8 rounded transition-all duration-150  data-deviated:bg-gray-400
                      ${
                        isActive
                          ? getActiveButtonStyle(instrument)
                          : "bg-gray-300 hover:bg-gray-400"
                      }
                    `}
                  />
                ))
              )}
            </div>
          </div>
        }
        bottom={
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <ChannelDisplayItem
                  label="Length"
                  value={`${state.patternLength} steps`}
                  className="[&>.value]:text-blue-600"
                />
                <ChannelDisplayItem
                  label="Density"
                  value={`${Math.round(state.density * 100)}%`}
                  className="[&>.value]:text-green-600"
                />
                <ChannelDisplayItem
                  label="Deviation"
                  value={`${Math.round(state.deviation * 100)}%`}
                  className="[&>.value]:text-purple-600"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      pattern: getRandomPattern(
                        state.patternLength,
                        state.density
                      ),
                    })
                  }
                  className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                >
                  Random
                </button>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      pattern: getEmptyPattern(state.patternLength),
                    })
                  }
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <Slider
              min={3}
              max={16}
              step={1}
              value={state.patternLength}
              onChange={(value) =>
                setState({
                  ...state,
                  patternLength: value,
                  pattern: getPatternWithLength(state.pattern, value),
                })
              }
              className="w-full slider-blue-600"
              notchesCount={14}
            />
            <Slider
              min={0.1}
              max={1.0}
              step={0.1}
              value={state.density}
              onChange={(value) =>
                setState({
                  ...state,
                  density: value,
                  pattern: getRandomPattern(state.patternLength, value),
                })
              }
              className="w-full slider-green-600"
            />
            <Slider
              min={0.0}
              max={0.2}
              step={0.01}
              value={state.deviation}
              onChange={(value) =>
                setState({
                  ...state,
                  deviation: value,
                })
              }
              className="w-full slider-purple-600"
            />
          </div>
        }
      />
    );
  },
});

function getActiveButtonStyle(instrument: InstrumentType): string {
  const styles = {
    kick: "bg-red-500 hover:bg-red-600 data-[active]:bg-red-400",
    hat: "bg-yellow-500 hover:bg-yellow-600 data-[active]:bg-yellow-400",
    tom: "bg-blue-500 hover:bg-blue-600 data-[active]:bg-blue-400",
    snare: "bg-green-500 hover:bg-green-600 data-[active]:bg-green-400",
  };
  return styles[instrument];
}

function createSequence(
  pattern: StepPattern,
  synths: {
    kick: ReturnType<typeof get909KickSynth>;
    hat: ReturnType<typeof getHatSynth>;
    tom: ReturnType<typeof getLowTomSynth>;
    snare: ReturnType<typeof getSnareSynth>;
  },
  patternLength: number,
  deviation: number
) {
  const steps = Array.from({ length: patternLength }, (_, i) => i);

  // Calculate step duration so the entire pattern fits in one measure
  // 1m = 1 measure, so each step duration = 1m / patternLength
  const stepDuration = Tone.Time("1m").toSeconds() / patternLength;

  return new Tone.Sequence(
    (time, stepIndex) => {
      // Calculate deviations for this step
      const deviations: Record<InstrumentType, boolean> = {
        kick: false,
        hat: false,
        tom: false,
        snare: false,
      };

      instruments.forEach((instrument) => {
        const originalValue = pattern[instrument][stepIndex];
        // Apply deviation: chance to flip the original value
        const shouldDeviate = Math.random() < deviation;
        deviations[instrument] = shouldDeviate;
        const actualValue = shouldDeviate ? !originalValue : originalValue;

        if (actualValue) {
          synths[instrument].hit(time);
        }
      });

      updateHighlighting(time, stepIndex, deviations);
    },
    steps,
    stepDuration
  ).set({ loop: true });
}

// Hi-hat synth
function getHatSynth() {
  const synth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.05,
      sustain: 0,
    },
  })
    .connect(
      new Tone.Filter({
        type: "highpass",
        frequency: 8000,
      })
    )
    .connect(new Tone.Gain(0.3).toDestination());

  return {
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("32n", time);
    },
    dispose: () => {
      synth.dispose();
    },
  };
}

function updateHighlighting(
  time: Tone.Unit.Time,
  stepIndex: number,
  deviations: Record<InstrumentType, boolean>
) {
  Tone.getDraw().schedule(() => {
    // First, remove highlighting and deviation attributes from all cells
    document.querySelectorAll("[data-step]").forEach((el) => {
      delete (el as HTMLElement).dataset.active;
      delete (el as HTMLElement).dataset.deviated;
    });

    // Then, add highlighting to all cells in the current step
    document.querySelectorAll(`[data-step="${stepIndex}"]`).forEach((el) => {
      const instrument = (el as HTMLElement).dataset
        .instrument as InstrumentType;
      if (!deviations[instrument]) {
        (el as HTMLElement).dataset.active = "true";
      }
      if (instrument && deviations[instrument]) {
        (el as HTMLElement).dataset.deviated = "true";
      }
    });
  }, time);
}

function getRandomPattern(length: number, density: number): StepPattern {
  return {
    kick: Array.from({ length }, () => Math.random() < density),
    hat: Array.from({ length }, () => Math.random() < density),
    tom: Array.from({ length }, () => Math.random() < density),
    snare: Array.from({ length }, () => Math.random() < density),
  };
}
function getEmptyPattern(length: number): StepPattern {
  return {
    kick: Array(length).fill(false),
    hat: Array(length).fill(false),
    tom: Array(length).fill(false),
    snare: Array(length).fill(false),
  };
}
function getPatternWithLength(
  pattern: StepPattern,
  length: number
): StepPattern {
  return {
    kick: Array.from({ length }, (_, i) => pattern.kick[i] || false),
    hat: Array.from({ length }, (_, i) => pattern.hat[i] || false),
    tom: Array.from({ length }, (_, i) => pattern.tom[i] || false),
    snare: Array.from({ length }, (_, i) => pattern.snare[i] || false),
  };
}
