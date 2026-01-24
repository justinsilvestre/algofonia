import { defineChannel } from "../Channel";
import { ToneControls } from "../tone";

export const synth = defineChannel({
  initialize: (tone: ToneControls) => {
    // Placeholder for synth channel initialization
    return {
      controls: {},
      state: { boop: "scoop" },
    };
  },
  teardown: (nodes, channelState) => {
    // Placeholder for synth channel teardown
  },
  onStateChange: (tone, state, prevState) => {},
});
