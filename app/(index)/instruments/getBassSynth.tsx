import * as Tone from "tone";

export function getBassSynth() {
  // Create a low-pass filter for warmth
  const lowPassFilter = new Tone.Filter({
    frequency: 800,
    type: "lowpass",
    rolloff: -24,
    Q: 1.5,
  });

  // Create a high-pass filter to clean up low-end mud
  const highPassFilter = new Tone.Filter({
    frequency: 40,
    type: "highpass",
    rolloff: -12,
    Q: 0.7,
  });

  // Subtle saturation for warmth
  const saturator = new Tone.Distortion({
    distortion: 0.05,
  });

  // Compressor for punch
  const compressor = new Tone.Compressor({
    threshold: -12,
    ratio: 4,
    attack: 0.003,
    release: 0.1,
  });

  // Main bass synthesizer - fat and warm
  const bassSynth = new Tone.MonoSynth({
    volume: -8,
    oscillator: {
      type: "fatsawtooth3",
    },
    envelope: {
      attack: 0.05,
      decay: 0.3,
      sustain: 0.7,
      release: 1.0,
    },
    filter: {
      Q: 2,
      frequency: 300,
      type: "lowpass",
      rolloff: -24,
    },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.5,
      sustain: 0.3,
      release: 2,
      baseFrequency: 100,
      octaves: 2,
    },
  });

  // Connect signal chain
  bassSynth
    .connect(saturator)
    .connect(highPassFilter)
    .connect(lowPassFilter)
    .connect(compressor)
    .toDestination();

  return {
    bassSynth,
    lowPassFilter,
    highPassFilter,
    saturator,
    compressor,
    dispose: () => {
      bassSynth.dispose();
      lowPassFilter.dispose();
      highPassFilter.dispose();
      saturator.dispose();
      compressor.dispose();
    },
  };
}
