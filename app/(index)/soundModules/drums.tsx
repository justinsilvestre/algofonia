import * as Tone from "tone";
import { defineSoundModule } from "../tone";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";
import { Slider } from "../SoundModuleDisplaySlider";
import { get909KickSynth } from "../instruments/get909KickSynth";
import { getSnareSynth } from "../instruments/getSnareSynth";

type DrumEvent = "K" | "S" | "KS" | null | DrumEvent[];
type PatternName = keyof typeof patterns;

const patterns = {
  SILENT: [],
  TWO_STEP_KICK: ["K", null, [null, "K"], null],
  TWO_STEP_KICK_AND_SNARE: ["K", "S", [null, "K"], "S"],
  FOUR_ON_FLOOR: ["K", "KS", "K", "KS"],
  ADDED_SYNCOPATION: [["K", null, null, "K"], "KS", ["K", "K"], "KS"],
} as const satisfies Record<string, DrumEvent[]>;

export const drums = defineSoundModule({
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
      <SoundModuleDisplay
        title="Drums"
        className="w-100"
        boxContents={
          <SoundModuleDisplayItem
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
});
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
