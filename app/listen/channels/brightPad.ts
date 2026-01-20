import * as Tone from "tone";
import { createChannel } from "../tone";
import { Chord, Scale, Key } from "tonal";

import { BrightAmbientPad } from "../synth/brightPad";

export const brightPad = createChannel({
  key: "Bright Ambient Pad",

  initialize: () => {
    const pad = new BrightAmbientPad();

    pad.setDelayAmount(0.0);
    pad.setSparkleRate(1);
    pad.setSparkleDepth(0.1, 0.5);
    pad.start();

    const octave = 4;
    const isPlaying = false;

    return { pad, octave, isPlaying };
  },
  teardown: () => {}, // placeholder
  onLoop: ({ transport, key, mode }, channelState, time) => {
    if (channelState.isPlaying) return;

    const scale = `${key}${channelState.octave} ${mode}`;
    const notes = Scale.get(scale).notes;

    channelState.pad.playChordEternal([notes[0], notes[3], notes[5]], time);
    channelState.isPlaying = true;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    const delay = frontToBack / 100;

    const depthMin = around / 200 + 0.1;
    const depthMax = depthMin + 0.4;
    const rate = depthMin * 6;

    channelState.pad.setDelayAmount(delay);
    channelState.pad.setSparkleRate(rate);
    channelState.pad.setSparkleDepth(depthMin, depthMax);
  },
});
