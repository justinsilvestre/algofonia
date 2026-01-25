import * as Tone from "tone";

export function getLowTomSynth() {
  // Create a more tom-like sound with proper frequency range
  const fundamentalSynth = new Tone.Synth({
    oscillator: { type: "triangle" }, // More harmonically rich than sine
    envelope: {
      attack: 0.001, // Much faster attack for punch
      decay: 0.6,
      sustain: 0,
      release: 0.05,
    },
  });

  // Add a sub component for body
  const subSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.0005, // Even faster attack for sub punch
      decay: 0.4,
      sustain: 0,
      release: 0.02,
    },
  });

  // Tom-appropriate filtering - higher cutoff for clarity
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: 800, // Higher cutoff for tom clarity
    Q: 1.5, // Less resonance
  });

  // Light saturation for warmth without muddiness
  const distortion = new Tone.Distortion({
    distortion: 0.1, // Much lighter distortion
    oversample: "2x",
  });

  // Chain: fundamental -> filter -> distortion -> destination
  // Sub goes through same chain for consistency
  fundamentalSynth.chain(filter, distortion, Tone.getDestination());
  subSynth.connect(filter);

  const baseVolume = 3;
  fundamentalSynth.volume.value = baseVolume;
  subSynth.volume.value = baseVolume - 6; // Sub is quieter

  return {
    synth: fundamentalSynth, // Keep for compatibility
    subSynth,
    dispose: () => {
      fundamentalSynth.dispose();
      subSynth.dispose();
      filter.dispose();
      distortion.dispose();
    },
    hit: (time: Tone.Unit.Time = Tone.now()) => {
      const timeSeconds = Tone.Time(time).toSeconds();
      const highTone = "F3"; // Fundamental tom pitch
      const lowTone = "F2"; // Sub an octave lower

      // Trigger both synths at tom-appropriate pitch
      fundamentalSynth.triggerAttack(highTone, time); // Higher fundamental for tom
      subSynth.triggerAttack(lowTone, time); // Sub an octave lower

      // Tom-like pitch bend - more subtle than kick
      fundamentalSynth.frequency.setValueAtTime(175, time); // Start at F3
      fundamentalSynth.frequency.exponentialRampToValueAtTime(
        120,
        timeSeconds + 0.12
      ); // Moderate dip, tom-like duration

      // Sub has a very subtle dip
      subSynth.frequency.setValueAtTime(87, time);
      subSynth.frequency.exponentialRampToValueAtTime(80, timeSeconds + 0.08);

      // Release both with tom-like timing
      fundamentalSynth.triggerRelease(timeSeconds + 0.6);
      subSynth.triggerRelease(timeSeconds + 0.4);
    },
    setVolume: (volume: number) => {
      fundamentalSynth.volume.value = volume;
      subSynth.volume.value = volume - 6; // Keep sub quieter
    },
  };
}
