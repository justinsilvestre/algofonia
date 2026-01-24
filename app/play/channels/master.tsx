import { defineChannel } from "../Channel";
import { ChannelDisplay, ChannelDisplayItem } from "../ChannelDisplay";

export const master = defineChannel({
  initialize: ({ getBpm }) => {
    return {
      state: {
        bpm: getBpm(),
      },
      controls: {},
    };
  },
  teardown: () => {},
  onStateChange: ({ setBpm }, controls, state, previousState) => {
    if (state.bpm !== previousState.bpm) {
      setBpm(state.bpm);
      console.log("Setting new BPM to", state.bpm);
    }
  },
  renderMonitorDisplay: (state, setState) => {
    return (
      <ChannelDisplay
        title="Master"
        className="w-100"
        boxContents={
          <ChannelDisplayItem
            className="[&>.value]:text-blue-600"
            label="Tempo"
            value={`${Math.round(state.bpm)} bpm`}
          />
        }
        bottom={
          <Slider
            min={60}
            max={180}
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
        }
      />
    );
  },
});

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
