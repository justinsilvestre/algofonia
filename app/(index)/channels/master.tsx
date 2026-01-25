import { Scale } from "tonal";
import { defineChannel } from "../Channel";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";
import { Slider } from "../ChannelDisplaySlider";

// prettier-ignore
const pitches = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const scaleNames = Scale.names();

export const master = defineChannel({
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
  onStateChange: (tone, controls, state, previousState) => {
    const { setBpm } = tone;
    if (state.bpm !== previousState.bpm) {
      setBpm(state.bpm);
      console.log("Setting new BPM to", state.bpm);
    }
    tone.tonic = state.tonic;
    tone.scale = state.scale;
    tone.chordRootScaleDegree = state.chordRootScaleDegree;
  },
  renderMonitorDisplay: (state, setState) => {
    const tonicIndex = pitches.indexOf(state.tonic);

    return (
      <ChannelDisplay
        title="Master"
        className="w-100"
        boxContents={
          <div className="flex flex-row flex-wrap justify-between">
            <ChannelDisplayItem
              className="flex-1  [&>.value]:text-blue-600"
              label="Tempo"
              value={`${Math.round(state.bpm)} bpm`}
            />
            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-green-600"
              label="Tonic"
              value={state.tonic}
            />

            <ChannelDisplayItem
              className="flex-1 [&>.value]:text-purple-600"
              label="Chord Root"
              value={`${state.chordRootScaleDegree}`}
            />
            <ChannelDisplayItem
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
              onChange={(value) =>
                setState({
                  ...state,
                  bpm: value,
                })
              }
              className="w-full slider-blue-600"
            />
            <Slider
              min={0}
              max={pitches.length - 1}
              step={1}
              value={tonicIndex}
              onChange={(value) =>
                setState({
                  ...state,
                  tonic: pitches[value],
                })
              }
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
              onChange={(value) =>
                setState({
                  ...state,
                  scale: scaleNames[value],
                })
              }
              className="w-full slider-orange-600"
              notchesCount={scaleNames.length}
            />
          </>
        }
      />
    );
  },
});
