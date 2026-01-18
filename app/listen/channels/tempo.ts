import { createChannel } from "../tone";

export const tempo = createChannel({
  key: "Tempo",
  initialize: () => {
    return {};
  },
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
});
