import * as Tone from "tone";

export function getSnareSynth() {
  const synth = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: {
      attack: 0.001,
      decay: 0.18,
      sustain: 0.05,
    },
  })
    .connect(new Tone.Filter(2200, "highpass"))
    .toDestination();

  return {
    synth,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    dispose: () => {
      synth.dispose();
    },
  };
}
