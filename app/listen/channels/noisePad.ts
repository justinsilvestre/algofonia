import * as Tone from "tone";
import { createChannel } from "../tone";

import { NoisePad } from "../synth/noisePad";

export const noisePad = createChannel({
  key: "Noise Pad",

  initialize: () => {
    const pad = new NoisePad();

    const isPlaying = false;

    return { pad, isPlaying };
  },
  onLoop: ({ transport, key, mode }, channelState, time) => {
    if (channelState.isPlaying) return;

    channelState.pad.start();
    channelState.isPlaying = true;

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    const semitones = (frontToBack / 100) * 12;
    const rate = around / 100 + 0.1;

    channelState.pad.setPitchShift(semitones);
    channelState.pad.setAutoPannerRate(rate);

    return channelState;
  },
});
