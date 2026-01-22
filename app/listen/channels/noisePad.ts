import * as Tone from "tone";
import { createChannel } from "../tone";

import { NoisePad } from "../synth/noisePad";

export const noisePad = createChannel({
  key: "Noise Pad",

  initialize: () => {
    const pad = new NoisePad();
    pad.start();
    return { pad };
  },
  teardown: ({ pad }) => {
    pad.dispose();
  },
  respond: (tone, { getState }, { frontToBack, around }) => {
    const { pad } = getState();
    const semitones = (frontToBack / 100) * 12;
    const rate = around / 100 + 0.1;

    pad.setPitchShift(semitones);
    pad.setAutoPannerRate(rate);
  },
});
