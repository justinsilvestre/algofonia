import * as Tone from "tone";

export class BassSynth {
  mainSynth: Tone.MonoSynth;
  subSynth: Tone.MonoSynth;
  distortion: Tone.Distortion;
  eq: Tone.EQ3;
  compressor: Tone.Compressor;
  chorus: Tone.Chorus;
  reverb: Tone.Reverb;
  gain: Tone.Gain;

  constructor(masterVolume: number) {
    // Main bass voice - sawtooth for brightness
    this.mainSynth = new Tone.MonoSynth({
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.6,
        release: 0.4,
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 200,
        octaves: 1,
      },
    });

    // Sub-bass voice - sine wave one octave down
    this.subSynth = new Tone.MonoSynth({
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.8,
        release: 0.5,
      },
      filter: {
        type: "lowpass",
        frequency: 50,
        Q: 1,
      },
    });

    // Saturation for warmth and harmonics
    this.distortion = new Tone.Distortion({
      distortion: 0.4,
      wet: 0.3,
    });

    // EQ to boost sub frequencies
    this.eq = new Tone.EQ3({
      low: 6,
      mid: 0,
      high: -3,
      lowFrequency: 100,
      highFrequency: 2500,
    });

    // Compression to glue it together
    this.compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 4,
      attack: 0.003,
      release: 0.1,
    });

    // Subtle chorus for width
    this.chorus = new Tone.Chorus({
      frequency: 2,
      delayTime: 2.5,
      depth: 0.3,
      wet: 0.2,
    }).start();

    // Short reverb
    this.reverb = new Tone.Reverb({
      decay: 0.8,
      wet: 0.1,
    });

    // Master gain
    this.gain = new Tone.Gain(0.025 * masterVolume);

    // Connect main synth chain
    this.mainSynth.chain(
      this.distortion,
      this.chorus,
      this.eq,
      this.compressor,
      this.reverb,
      this.gain,
      Tone.getDestination()
    );

    // Connect sub synth directly (bypass effects for clarity)
    this.subSynth.chain(this.compressor, this.gain);

    this.reverb.generate();
  }

  playNote(
    note: string | number,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time
  ): void {
    note = Tone.Frequency(note).transpose(-12).toNote();
    // Play main note
    this.mainSynth.triggerAttackRelease(note, duration, time);

    // Play sub-bass one octave lower
    const subNote = Tone.Frequency(note).transpose(-24).toNote();
    this.subSynth.triggerAttackRelease(subNote, duration, time);
  }

  dispose(): void {
    this.mainSynth.dispose();
    this.subSynth.dispose();
    this.distortion.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.chorus.dispose();
    this.reverb.dispose();
    this.gain.dispose();
  }
}
