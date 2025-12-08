
import * as Tone from "tone";
import { createChannel } from "../tone";

import { GranularCloud } from "../synth/granularCloud";

export const granularCloud = createChannel({
  key: "Granular Cloud",

  initialize: () => {
    const cloud = new GranularCloud('/samples/Perry Como - Please Believe Me.mp3');

    cloud.setDriftSpeed(0.02);
    cloud.setGrainSize(0.15, 0.25);
    cloud.setDensity(0.1);
    cloud.setDarkness(0.2);

    const isPlaying = false;

    return { cloud, isPlaying };
  },
  onLoop: ({ transport, key, mode }, channelState, time) => {
    if (channelState.isPlaying) return;

    channelState.cloud.start().then(() => {;
      channelState.isPlaying = true;
    });

    return channelState;
  }
});

