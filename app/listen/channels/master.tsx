import { createChannel } from "../tone";

export const master = createChannel({
  key: "Master",
  initialize: (tone) => {
    return {
      bpm: tone.getBpm(),
    };
  },
  teardown: () => {},
  respond: (tone, { getState, setState }, { frontToBack }) => {
    const channelState = getState();
    // min bpm of 60, max of 180
    const newBpm = Math.round(60 + (frontToBack / 100) * 120);
    // if (Math.abs(newBpm - bpm) > 15) {
    if (newBpm === channelState.bpm) return;
    tone.setBpm(newBpm);
    console.log("Setting new BPM to", newBpm);
    setState({
      ...channelState,
      bpm: newBpm,
    });
    // }
  },
  renderMonitorDisplay: ({ bpm }) => {
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
