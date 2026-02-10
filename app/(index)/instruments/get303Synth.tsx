import * as Tone from "tone";

export function get303Synth() {
  // Classic 303 low-pass filter with envelope modulation
  const filter = new Tone.Filter({
    frequency: 350, // Starting cutoff frequency
    type: "lowpass",
    rolloff: -24, // Steep 24dB/octave rolloff like the 303
    Q: 15, // High resonance for that classic 303 squelch
  });

  // Filter envelope for classic 303 sweep
  const filterEnvelope = new Tone.Envelope({
    attack: 0.01, // Quick attack
    decay: 0.3, // Medium decay for the sweep
    sustain: 0.0, // No sustain - classic 303 behavior
    release: 0.3, // Quick release
  });

  // Scale the envelope to modulate filter frequency
  const envModAmount = new Tone.Multiply(3500); // Envelope modulation amount
  const filterFreqMod = new Tone.Add(350); // Base frequency (will be updated dynamically)

  // Connect filter envelope to modulate around the base frequency
  filterEnvelope.connect(envModAmount);
  envModAmount.connect(filterFreqMod);

  // Amplitude envelope for classic 303 dynamics
  const ampEnvelope = new Tone.Envelope({
    attack: 0.01,
    decay: 0.1,
    sustain: 0.6,
    release: 0.3,
  });

  // VCA (Voltage Controlled Amplifier)
  const vca = new Tone.Gain(0);
  ampEnvelope.connect(vca.gain);

  // Classic 303 sawtooth oscillator
  const oscillator = new Tone.Oscillator({
    type: "sawtooth",
    frequency: "C2",
  });

  // Distortion for that classic 303 grit
  const distortion = new Tone.Distortion({
    distortion: 0.2,
    oversample: "4x",
  });

  // Simple delay for some space
  const delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.3,
    wet: 0.2,
  });

  // Compressor to tame the dynamics
  const compressor = new Tone.Compressor({
    threshold: -12,
    ratio: 4,
    attack: 0.003,
    release: 0.1,
  });

  // Output volume control
  const outputVolume = new Tone.Gain(0.3); // Reduced volume to not overpower other instruments

  // Signal chain: Oscillator -> Filter -> VCA -> Distortion -> Delay -> Compressor -> Volume -> Output
  oscillator.connect(filter);
  filter.connect(vca);
  vca.connect(distortion);
  distortion.connect(delay);
  delay.connect(compressor);
  compressor.connect(outputVolume);
  outputVolume.toDestination();

  // Start the oscillator
  oscillator.start();

  const triggerAttackRelease = (
    note: Tone.Unit.Frequency,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity: number = 1,
    accent: boolean = false
  ) => {
    const when = time || Tone.now();

    // Set oscillator frequency
    oscillator.frequency.setValueAtTime(note, when);

    // Adjust envelope intensities based on accent
    const filterIntensity = accent ? 1.0 : 0.7;
    const ampIntensity = accent ? 1.0 : 0.8;

    // Trigger filter envelope with accent modulation
    filterEnvelope.triggerAttackRelease(
      duration,
      when,
      filterIntensity * velocity
    );

    // Trigger amplitude envelope
    ampEnvelope.triggerAttackRelease(duration, when, ampIntensity * velocity);
  };

  // Method to update the base cutoff frequency
  const setCutoffFrequency = (freq: number) => {
    // Disconnect the modulation temporarily
    filterFreqMod.disconnect();

    // Update the base frequency
    filterFreqMod.value = freq;

    // Reconnect: base freq + envelope modulation -> filter frequency
    filterFreqMod.connect(filter.frequency);
  };

  // Initially connect the modulation
  setCutoffFrequency(350);

  const dispose = () => {
    oscillator.dispose();
    filter.dispose();
    filterEnvelope.dispose();
    ampEnvelope.dispose();
    envModAmount.dispose();
    filterFreqMod.dispose();
    vca.dispose();
    distortion.dispose();
    delay.dispose();
    compressor.dispose();
    outputVolume.dispose();
  };

  return {
    triggerAttackRelease,
    setCutoffFrequency,
    dispose,
    // Expose components for real-time control
    filter,
    filterEnvelope,
    ampEnvelope,
    oscillator,
    distortion,
    delay,
    compressor,
    outputVolume,
    envModAmount, // For controlling envelope modulation amount
  };
}
