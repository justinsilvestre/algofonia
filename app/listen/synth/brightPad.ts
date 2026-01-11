import * as Tone from 'tone';

export class BrightAmbientPad {
  private shimmerLayer: Tone.PolySynth<Tone.FMSynth>;
  private metallicLayer: Tone.PolySynth<Tone.FMSynth>;
  private warmLayer: Tone.PolySynth<Tone.Synth>;
  private sparkleLayer: Tone.PolySynth<Tone.Synth>;

  private filter: Tone.Filter;
  private filterLFO: Tone.LFO;
  private filterLFO2: Tone.LFO;

  private vibrato: Tone.Vibrato;
  private tremolo: Tone.Tremolo;
  private phaser: Tone.Phaser;
  private chorus: Tone.Chorus;

  private stereoWidener: Tone.StereoWidener;
  private autoPanner: Tone.AutoPanner;
  private pitchShift: Tone.PitchShift;

  private reverb: Tone.Reverb;
  private reverbLFO: Tone.LFO;
  private delay: Tone.FeedbackDelay;
  private delayLFO: Tone.LFO;

  private brightnessLFO: Tone.LFO;

  private shimmerGain: Tone.Gain;
  private metallicGain: Tone.Gain;
  private warmGain: Tone.Gain;
  private sparkleGain: Tone.Gain;
  private masterGain: Tone.Gain;

  constructor() {
    // Shimmering FM layer
    this.shimmerLayer = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 12,
      oscillator: {
        type: 'sawtooth',
      },
      envelope: {
        attack: 2.0,
        decay: 0.8,
        sustain: 0.7,
        release: 3.5,
      },
      modulation: {
        type: 'sine',
      },
      modulationEnvelope: {
        attack: 1.5,
        decay: 0.3,
        sustain: 0.5,
        release: 2.0,
      },
    });

    // Bell-like metallic layer
    this.metallicLayer = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 8,
      modulationIndex: 20,
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.01,
        decay: 1.5,
        sustain: 0.3,
        release: 4.0,
      },
      modulation: {
        type: 'sine',
      },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.5,
        sustain: 0.1,
        release: 1.0,
      },
    });

    // Warm pad layer
    this.warmLayer = new Tone.PolySynth(Tone.AMSynth, {
      oscillator: {
        type: 'triangle',
        // @ts-expect-error not in ToneTypeOscillatorOptions
        count: 4,
        spread: 40,
      },
      envelope: {
        attack: 2.5,
        decay: 1.0,
        sustain: 0.8,
        release: 4.0,
      },
    });

    // High octave sparkle layer
    this.sparkleLayer = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
        // @ts-expect-error not in ToneTypeOscillatorOptions
        count: 2,
        spread: 10,
      },
      envelope: {
        attack: 1.0,
        decay: 2.0,
        sustain: 0.4,
        release: 5.0,
      },
    });

    // Bright filter with modulation
    this.filter = new Tone.Filter({
      frequency: 3500,
      type: 'lowpass',
      rolloff: -12,
      Q: 2,
    });

    // Primary filter LFO - slower sweep
    this.filterLFO = new Tone.LFO({
      frequency: 0.12,
      min: 2500,
      max: 5000,
      type: 'square',
    });
    this.filterLFO.connect(this.filter.frequency);

    // Secondary filter LFO for complexity
    this.filterLFO2 = new Tone.LFO({
      frequency: 0.05,
      min: -500,
      max: 500,
      type: 'triangle',
    });
    // this.filterLFO2.connect(this.filter.frequency);

    // Vibrato for organic movement
    this.vibrato = new Tone.Vibrato({
      frequency: 4,
      depth: 0.1,
      wet: 0.3,
    });

    // Tremolo for shimmer
    this.tremolo = new Tone.Tremolo({
      frequency: 8,
      depth: 0.3,
      wet: 0.4,
    });

    // Phaser for swirl
    this.phaser = new Tone.Phaser({
      frequency: 0.8,
      octaves: 4,
      baseFrequency: 1000,
      Q: 5,
      wet: 0.5,
    });

    // Chorus for width
    this.chorus = new Tone.Chorus({
      frequency: 2,
      delayTime: 4,
      depth: 0.7,
      wet: 0.6,
    });

    // Stereo widener
    this.stereoWidener = new Tone.StereoWidener({
      width: 0.8,
    });

    // Auto-panner for movement
    this.autoPanner = new Tone.AutoPanner({
      frequency: 0.08,
      depth: 0.5,
    });

    // Pitch shifter for detuning
    this.pitchShift = new Tone.PitchShift({
      pitch: 0,
      windowSize: 0.1,
      wet: 0.2,
    });

    // Reverb with shimmer
    this.reverb = new Tone.Reverb({
      decay: 10,
      preDelay: 0.02,
      wet: 0.8,
    });

    // Reverb LFO
    this.reverbLFO = new Tone.LFO({
      frequency: 0.06,
      min: 0.6,
      max: 0.95,
      type: 'sine',
    });
    this.reverbLFO.connect(this.reverb.wet);

    // Delay for space
    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.4,
      wet: 0.25,
    });

    // Delay time LFO for tape-like wobble
    this.delayLFO = new Tone.LFO({
      frequency: 0.15,
      min: 0.3,
      max: 0.5,
      type: 'sine',
    });
    this.delayLFO.connect(this.delay.delayTime);

    // Brightness LFO for sparkle
    this.brightnessLFO = new Tone.LFO({
      frequency: '8t',
      min: 0.5,
      max: 1.0,
      type: 'sine',
    });

    // Layer gains
    this.shimmerGain = new Tone.Gain(0.35);
    this.metallicGain = new Tone.Gain(0.15);
    this.warmGain = new Tone.Gain(0.4);
    this.sparkleGain = new Tone.Gain(0.2);

    // Master gain
    this.masterGain = new Tone.Gain(0.65);
    this.brightnessLFO.connect(this.masterGain.gain);

    // Connect shimmer layer (main)
    this.shimmerLayer.chain(
      this.shimmerGain,
      this.filter,
      this.vibrato,
      this.tremolo,
      this.phaser,
      this.chorus,
      this.pitchShift,
      this.stereoWidener,
      this.autoPanner,
      this.delay,
      this.reverb,
      this.masterGain,
      Tone.Destination
    );

    this.metallicLayer.chain(this.metallicGain, this.filter);
    this.warmLayer.chain(this.warmGain, this.filter);
    this.sparkleLayer.chain(this.sparkleGain, this.filter);

    this.reverb.generate();
    this.chorus.start();
    this.tremolo.start();
    this.autoPanner.start();
  }

  async start(): Promise<void> {
    // await Tone.start();
    this.filterLFO.start();
    this.filterLFO2.start();
    this.reverbLFO.start();
    this.delayLFO.start();
    this.brightnessLFO.start();
  }

  // Play with optional high octave sparkle
  playChord(
    notes: string | string[],
    duration = '4n',
    time: Tone.Unit.Time | undefined = undefined,
    withSparkle = true
  ): void {
    this.shimmerLayer.triggerAttackRelease(notes, duration, time);
    this.metallicLayer.triggerAttackRelease(notes, duration, time);
    this.warmLayer.triggerAttackRelease(notes, duration, time);

    if (withSparkle) {
      // Add sparkle layer one octave up
      const sparkleNotes = Array.isArray(notes)
        ? notes.map((n) => Tone.Frequency(n).transpose(12).toNote())
        : Tone.Frequency(notes).transpose(12).toNote();
      this.sparkleLayer.triggerAttackRelease(sparkleNotes, duration, time);
    }
  }

  // Eternal drone mode
  playChordEternal(
    notes: string | string[],
    time: Tone.Unit.Time,
    withSparkle = true
  ): void {
    this.shimmerLayer.triggerAttack(notes, time);
    this.metallicLayer.triggerAttack(notes, time);
    this.warmLayer.triggerAttack(notes, time);

    if (withSparkle) {
      const sparkleNotes = Array.isArray(notes)
        ? notes.map((n) => Tone.Frequency(n).transpose(12).toNote())
        : Tone.Frequency(notes).transpose(12).toNote();
      this.sparkleLayer.triggerAttack(sparkleNotes, time);
    }
  }

  releaseAll(): void {
    this.shimmerLayer.releaseAll();
    this.metallicLayer.releaseAll();
    this.warmLayer.releaseAll();
    this.sparkleLayer.releaseAll();
  }

  // Parameter controls
  setBrightness(amount: number): void {
    // 0-1: higher = brighter
    const cutoff = 2000 + amount * 3000;
    this.filter.frequency.value = cutoff;
  }

  setFilterLFORate(rate: number): void {
    this.filterLFO.frequency.value = rate;
  }

  setShimmer(amount: number): void {
    this.tremolo.depth.value = amount;
    this.vibrato.depth.value = amount * 0.3;
  }

  setPhaserDepth(depth: number): void {
    this.phaser.wet.value = depth;
  }

  setChorusDepth(depth: number): void {
    this.chorus.wet.value = depth;
  }

  setStereoWidth(width: number): void {
    this.stereoWidener.width.value = width;
  }

  setReverbAmount(wet: number): void {
    this.reverb.wet.value = wet;
  }

  setDelayAmount(wet: number): void {
    this.delay.wet.value = wet;
  }

  setDelayFeedback(feedback: number): void {
    this.delay.feedback.value = feedback;
  }

  setPitchShift(semitones: number): void {
    this.pitchShift.pitch = semitones;
  }

  setLayerMix(
    shimmer: number,
    metallic: number,
    warm: number,
    sparkle: number
  ): void {
    this.shimmerGain.gain.value = shimmer;
    this.metallicGain.gain.value = metallic;
    this.warmGain.gain.value = warm;
    this.sparkleGain.gain.value = sparkle;
  }

  setSparkleRate(rate: number): void {
    this.brightnessLFO.frequency.value = rate;
  }

  setSparkleDepth(min: number, max: number): void {
    this.brightnessLFO.min = min;
    this.brightnessLFO.max = max;
  }

  dispose(): void {
    this.shimmerLayer.dispose();
    this.metallicLayer.dispose();
    this.warmLayer.dispose();
    this.sparkleLayer.dispose();
    this.filter.dispose();
    this.filterLFO.dispose();
    this.filterLFO2.dispose();
    this.vibrato.dispose();
    this.tremolo.dispose();
    this.phaser.dispose();
    this.chorus.dispose();
    this.stereoWidener.dispose();
    this.autoPanner.dispose();
    this.pitchShift.dispose();
    this.reverb.dispose();
    this.reverbLFO.dispose();
    this.delay.dispose();
    this.delayLFO.dispose();
    this.brightnessLFO.dispose();
    this.shimmerGain.dispose();
    this.metallicGain.dispose();
    this.warmGain.dispose();
    this.sparkleGain.dispose();
    this.masterGain.dispose();
  }
}
