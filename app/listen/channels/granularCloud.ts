import * as Tone from "tone";
import { createChannel } from "../tone";

import { GranularCloud } from "../synth/granularCloud";

export const granularCloud = createChannel({
  key: "Granular Cloud",

  initialize: () => {
    const cloud = new GranularCloud(
      "/samples/Perry Como - Please Believe Me.mp3"
    );

    cloud.setDriftSpeed(0.02);
    cloud.setGrainSize(0.15, 0.25);
    cloud.setDensity(0.1);
    cloud.setDarkness(0.2);

    cloud.start();

    return { cloud };
  },
  teardown: ({ cloud }) => {
    cloud.dispose();
  },
  respond: (tone, channelState, input) => {
    // Handle motion input for granular cloud
  },
});
