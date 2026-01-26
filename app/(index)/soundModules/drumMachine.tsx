import * as Tone from "tone";
import * as React from "react";
import { defineSoundModule } from "../tone";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";
import { Slider } from "../SoundModuleDisplaySlider";
import { getSampleInstrument } from "../instruments/getSampleInstrument";

type InstrumentType = "kick" | "hat" | "tom" | "snare";
type StepPattern = Record<InstrumentType, boolean[]>; // Always 16 steps

const instruments: InstrumentType[] = ["kick", "hat", "tom", "snare"];

// Sample paths for drum sounds
const BASE_PATH = "/samples/deep_house_drum_samples/Deep House Drum Samples";

const SAMPLE_FILES = {
  kick: [
    "bd_909dwsd.wav",
    "bd_chicago.wav",
    "bd_dandans.wav",
    "bd_deephouser.wav",
    "bd_diesel.wav",
    "bd_dropped.wav",
    "bd_flir.wav",
    "bd_gas.wav",
    "bd_ghost.wav",
    "bd_hybrid.wav",
    "bd_isampleoldskool.wav",
    "bd_liked.wav",
    "bd_mainroom.wav",
    "bd_mirror.wav",
    "bd_nash.wav",
    "bd_newyear.wav",
    "bd_organicisin.wav",
    "bd_outdoor.wav",
    "bd_shoein.wav",
    "bd_sodeep.wav",
    "bd_sonikboom.wav",
    "bd_streek.wav",
    "bd_stripped.wav",
    "bd_sub808.wav",
    "bd_tech.wav",
    "bd_tripper.wav",
    "bd_uma.wav",
    "bd_untitled.wav",
    "bd_vintager.wav",
    "bd_vinylinstereo.wav",
  ],
  hat: [
    "hat_626.wav",
    "hat_ace.wav",
    "hat_addverb.wav",
    "hat_analog.wav",
    "hat_bebias.wav",
    "hat_bestfriend.wav",
    "hat_bigdeal.wav",
    "hat_blackmamba.wav",
    "hat_chart.wav",
    "hat_charter.wav",
    "hat_chipitaka.wav",
    "hat_classical.wav",
    "hat_classichousehat.wav",
    "hat_closer.wav",
    "hat_collective.wav",
    "hat_crackers.wav",
    "hat_critters.wav",
    "hat_cuppa.wav",
    "hat_darkstar.wav",
    "hat_deephouseopen.wav",
    "hat_drawn.wav",
    "hat_freekn.wav",
    "hat_gater.wav",
    "hat_glitchbitch.wav",
    "hat_hatgasm.wav",
    "hat_hattool.wav",
    "hat_jelly.wav",
    "hat_kate.wav",
    "hat_lights.wav",
    "hat_lilcloser.wav",
    "hat_mydustyhouse.wav",
    "hat_myfavouriteopen.wav",
    "hat_negative6.wav",
    "hat_nice909open.wav",
    "hat_niner0niner.wav",
    "hat_omgopen.wav",
    "hat_openiner.wav",
    "hat_original.wav",
    "hat_quentin.wav",
    "hat_rawsample.wav",
    "hat_retired.wav",
    "hat_sampleking.wav",
    "hat_samplekingdom.wav",
    "hat_sharp.wav",
    "hat_soff.wav",
    "hat_spreadertrick.wav",
    "hat_stereosonic.wav",
    "hat_tameit.wav",
    "hat_vintagespread.wav",
    "hat_void.wav",
  ],
  tom: [
    "tom_909fatty.wav",
    "tom_909onvinyl.wav",
    "tom_cleansweep.wav",
    "tom_dept.wav",
    "tom_discodisco.wav",
    "tom_eclipse.wav",
    "tom_enriched.wav",
    "tom_enrico.wav",
    "tom_greatwhite.wav",
    "tom_iloveroland.wav",
    "tom_madisonave.wav",
    "tom_ofalltoms.wav",
    "tom_summerdayze.wav",
    "tom_taste.wav",
    "tom_vsneve.wav",
  ],
  snare: [
    "snr_analogging.wav",
    "snr_answer8bit.wav",
    "snr_bland.wav",
    "snr_drm909kit.wav",
    "snr_dwreal.wav",
    "snr_housey.wav",
    "snr_mpc.wav",
    "snr_myclassicsnare.wav",
    "snr_owned.wav",
    "snr_royalty.wav",
    "snr_rusnarious.wav",
    "snr_truevintage.wav",
  ],
};

function getRandomSampleFile(instrumentType: InstrumentType): string {
  const files = SAMPLE_FILES[instrumentType];
  const randomIndex = Math.floor(Math.random() * files.length);
  return files[randomIndex];
}

function getSamplePath(
  instrumentType: InstrumentType,
  filename: string
): string {
  const folderName =
    instrumentType === "kick"
      ? "bd_kick"
      : instrumentType === "hat"
        ? "hats"
        : instrumentType === "tom"
          ? "toms"
          : "snare";
  return `${BASE_PATH}/${folderName}/${filename}`;
}

function getRandomSampleFiles() {
  return {
    kick: getRandomSampleFile("kick"),
    hat: getRandomSampleFile("hat"),
    tom: getRandomSampleFile("tom"),
    snare: getRandomSampleFile("snare"),
  };
}

export const drumMachine = defineSoundModule({
  initialize: ({ currentMeasureStartTime }) => {
    const sampleFiles = getRandomSampleFiles();

    const kick = getSampleInstrument(getSamplePath("kick", sampleFiles.kick));
    const hat = getSampleInstrument(getSamplePath("hat", sampleFiles.hat));
    const tom = getSampleInstrument(getSamplePath("tom", sampleFiles.tom));
    const snare = getSampleInstrument(
      getSamplePath("snare", sampleFiles.snare)
    );

    const initialPatternLength = 16;
    const initialPattern = getEmptyPattern(); // Always 16 steps

    const sequence = createSequence(
      initialPattern,
      { kick, hat, tom, snare },
      initialPatternLength,
      0.0
    );
    sequence.start(currentMeasureStartTime);

    return {
      state: {
        pattern: initialPattern, // Always 16 steps
        patternLength: initialPatternLength,
        isPlaying: true,
        density: 0.3,
        deviation: 0.0,
        sampleFiles,
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
    // Check if sample files have changed
    const sampleFilesChanged =
      JSON.stringify(state.sampleFiles) !==
      JSON.stringify(previousState.sampleFiles);

    if (sampleFilesChanged) {
      // Dispose old instruments
      controls.kick.dispose();
      controls.hat.dispose();
      controls.tom.dispose();
      controls.snare.dispose();

      // Create new instruments with new samples
      controls.kick = getSampleInstrument(
        getSamplePath("kick", state.sampleFiles.kick)
      );
      controls.hat = getSampleInstrument(
        getSamplePath("hat", state.sampleFiles.hat)
      );
      controls.tom = getSampleInstrument(
        getSamplePath("tom", state.sampleFiles.tom)
      );
      controls.snare = getSampleInstrument(
        getSamplePath("snare", state.sampleFiles.snare)
      );
    }

    // Update sequence when pattern changes or length changes or samples change
    if (
      JSON.stringify(state.pattern) !== JSON.stringify(previousState.pattern) ||
      state.patternLength !== previousState.patternLength ||
      state.deviation !== previousState.deviation ||
      sampleFilesChanged
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
      <SoundModuleDisplay
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
                state.pattern[instrument]
                  .slice(0, state.patternLength)
                  .map((isActive, stepIndex) => (
                    <button
                      key={`${instrument}-${stepIndex}`}
                      data-step={stepIndex}
                      data-instrument={instrument}
                      title={state.sampleFiles[instrument]}
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
                <SoundModuleDisplayItem
                  label="Length"
                  value={`${state.patternLength} steps`}
                  className="[&>.value]:text-blue-600"
                />
                <SoundModuleDisplayItem
                  label="Density"
                  value={`${Math.round(state.density * 100)}%`}
                  className="[&>.value]:text-green-600"
                />
                <SoundModuleDisplayItem
                  label="Deviation"
                  value={`${Math.round(state.deviation * 100)}%`}
                  className="[&>.value]:text-blue-600"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      pattern: getRandomPattern(state.density),
                    })
                  }
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  Rhythm
                </button>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      sampleFiles: getRandomSampleFiles(),
                    })
                  }
                  className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                >
                  Samples
                </button>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      pattern: getRandomPattern(state.density),
                      sampleFiles: getRandomSampleFiles(),
                    })
                  }
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Both
                </button>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      pattern: getEmptyPattern(),
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
                  // pattern stays the same - no truncation
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
                  pattern: getRandomPattern(value),
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
    kick: ReturnType<typeof getSampleInstrument>;
    hat: ReturnType<typeof getSampleInstrument>;
    tom: ReturnType<typeof getSampleInstrument>;
    snare: ReturnType<typeof getSampleInstrument>;
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

function getRandomPattern(density: number): StepPattern {
  return {
    kick: Array.from({ length: 16 }, () => Math.random() < density),
    hat: Array.from({ length: 16 }, () => Math.random() < density),
    tom: Array.from({ length: 16 }, () => Math.random() < density),
    snare: Array.from({ length: 16 }, () => Math.random() < density),
  };
}
function getEmptyPattern(): StepPattern {
  return {
    kick: Array(16).fill(false),
    hat: Array(16).fill(false),
    tom: Array(16).fill(false),
    snare: Array(16).fill(false),
  };
}
