import { defineSoundModule } from "../tone";
import { ToneControls } from "../tone";

export const synth = defineSoundModule({
  initialize: (tone: ToneControls) => {
    // Placeholder for synth soundModule initialization
    return {
      controls: {},
      state: { boop: "scoop" },
    };
  },
  teardown: (nodes, soundModuleState) => {
    // Placeholder for synth soundModule teardown
  },
  onStateChange: (tone, state, prevState) => {},
});
