import * as Tone from "tone";
import { createChannel } from "../tone";
import { Scale } from "tonal";

export const padSynth = createChannel({
  key: "Pad Synth",
  initialize: () => {
    const fmSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5,
      modulationIndex: 8,
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: "16n",
        decay: 1.0,
        sustain: 0.8,
        release: 4.0,
      },
      modulation: {
        type: "triangle",
      },
      modulationEnvelope: {
        attack: "8n",
        decay: 0.5,
        sustain: 0.6,
        release: 2.0,
      },
    });

    const phaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350,
      Q: 10,
      wet: 0.4,
    });
    const chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 8,
      depth: 0.8,
      wet: 0.5,
    });

    // Volume LFO for breathing effect
    const volumeLFO = new Tone.LFO({
      frequency: "12hz",
      min: 0.05,
      max: 0.5,
      type: "triangle",
    });
    const masterGain = new Tone.Gain(0.2);
    volumeLFO.connect(masterGain.gain);

    fmSynth.chain(phaser, chorus, masterGain, Tone.getDestination());

    chorus.start();
    volumeLFO.start();
    return { fmSynth, octave: 3 };
  },
  onLoop: (tone, channelState, time) => {
    const { fmSynth } = channelState;
    const { key, mode } = tone;
    const scale = `${key}${channelState.octave} ${mode}`;
    const scaleNotes = Scale.get(scale).notes;
    const notes = [scaleNotes[0], scaleNotes[3], scaleNotes[5]];
    fmSynth.releaseAll(time);
    fmSynth.triggerAttack(notes, time);

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    // 10 to 30
    const modulationIndex = 10 + (frontToBack / 100) * 20;
    // 1.5 to 2.5
    const harmonicity = 1.5 + ((100 - around) / 100) * 1.0;

    channelState.fmSynth.set({
      modulationIndex,
      harmonicity,
    });

    return channelState;
  },
});
