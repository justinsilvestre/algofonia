import { Scale } from "tonal";
import { defineSoundModule } from "../tone";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";
import { Slider } from "../SoundModuleDisplaySlider";

// prettier-ignore
const pitches = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const scaleNames = Scale.names();

export const master = defineSoundModule({
  initialize: ({ getBpm, tonic, chordRootScaleDegree }) => {
    return {
      state: {
        bpm: getBpm(),
        tonic,
        scale: "minor",
        chordRootScaleDegree,
      },
      controls: {},
    };
  },
  teardown: () => {},
  onToneEvent: {
    tonicChange: (controls, state, tone, newTonic, setState) => {
      setState({
        ...state,
        tonic: newTonic,
      });
    },
    bpmChange: (controls, state, tone, newBpm, setState) => {
      setState({
        ...state,
        bpm: newBpm,
      });
    },
    scaleChange: (controls, state, tone, newScale, setState) => {
      setState({
        ...state,
        scale: newScale,
      });
    },
    chordRootScaleDegreeChange: (
      controls,
      state,
      tone,
      newChordRootScaleDegree,
      setState
    ) => {
      setState({
        ...state,
        chordRootScaleDegree: newChordRootScaleDegree,
      });
    },
  },
  renderMonitorDisplay: (state, setState, tone) => {
    const tonicIndex = pitches.indexOf(state.tonic);

    return (
      <SoundModuleDisplay
        title="Master"
        className="w-100"
        boxContents={
          <div className="flex flex-row flex-wrap justify-between">
            <SoundModuleDisplayItem
              className="flex-1  [&>.value]:text-blue-600"
              label="Tempo"
              value={`${Math.round(state.bpm)} bpm`}
            />
            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-green-600"
              label="Tonic"
              value={state.tonic}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-purple-600"
              label="Chord Root"
              value={`${state.chordRootScaleDegree}`}
            />
            <SoundModuleDisplayItem
              className="flex-1 basis-full [&>.value]:text-orange-600"
              label="Scale"
              value={scaleNames.includes(state.scale) ? state.scale : "Custom"}
            />
          </div>
        }
        bottom={
          <>
            <Slider
              min={60}
              max={250}
              step={1}
              value={state.bpm}
              onChange={(value) => tone.setBpm(value)}
              className="w-full slider-blue-600"
            />
            <Slider
              min={0}
              max={pitches.length - 1}
              step={1}
              value={tonicIndex}
              onChange={(value) => (tone.tonic = pitches[value])}
              className="w-full slider-green-600"
              notchesCount={pitches.length}
            />

            <Slider
              min={1}
              max={7}
              step={1}
              value={state.chordRootScaleDegree}
              onChange={(value) =>
                setState({
                  ...state,
                  chordRootScaleDegree: value,
                })
              }
              className="w-full slider-purple-600"
              notchesCount={7}
            />
            <Slider
              min={0}
              max={scaleNames.length - 1}
              step={1}
              value={Math.max(0, scaleNames.indexOf(state.scale))}
              onChange={(value) => (tone.scale = scaleNames[value])}
              className="w-full slider-orange-600"
              notchesCount={scaleNames.length}
            />
          </>
        }
      />
    );
  },
});
