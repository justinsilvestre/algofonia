import { createChannel } from "../tone";

export const master = createChannel({
  key: "Master",
  initialize: () => {
    return {};
  },
  teardown: () => {},
  onLoop: (tone, channelState, time) => {
    return channelState;
  },
  respond: (tone, channelState, { frontToBack }) => {
    const bpm = tone.getBpm();
    // min bpm of 60, max of 180
    const newBpm = Math.round(60 + (frontToBack / 100) * 120);
    if (Math.abs(newBpm - bpm) > 15) {
      tone.setBpm(newBpm);
      console.log("Setting new BPM to", newBpm);
    }

    return channelState;
  },
  renderMonitorDisplay: (channelState, tone, { frontToBack, around }) => {
    const bpm = tone.getBpm();
    return (
      <div className="flex-1 text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="flex flex-col items-start">
          <span className="text-gray-400">Tempo</span>
          <span className="font-mono text-base text-blue-400">
            {Math.round(bpm)} bpm
          </span>
        </div>
      </div>
    );
  },
});
