import * as Tone from "tone";

export class DarkAmbientPad {
  private layer1: Tone.PolySynth<Tone.FMSynth>;
  private layer2: Tone.PolySynth<Tone.Synth>;
  private layer3: Tone.PolySynth<Tone.Synth>;

  private filter: Tone.Filter;
  private filterLFO: Tone.LFO;
  private filterLFO2: Tone.LFO;

  private phaser: Tone.Phaser;
  private chorus: Tone.Chorus;
  private autoPanner: Tone.AutoPanner;
  private freqShifter: Tone.FrequencyShifter;
  private bitCrusher: Tone.BitCrusher;

  private reverb: Tone.Reverb;
  private reverbLFO: Tone.LFO;

  private volumeLFO: Tone.LFO;
  private layer1Gain: Tone.Gain;
  private layer2Gain: Tone.Gain;
  private layer3Gain: Tone.Gain;
  private masterGain: Tone.Gain;

  constructor() {
    // Three-layer synth for massive depth
    this.layer1 = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5,
      modulationIndex: 8,
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 3.0,
        decay: 1.0,
        sustain: 0.8,
        release: 4.0,
      },
      modulation: {
        type: "triangle",
      },
      modulationEnvelope: {
        attack: 2.0,
        decay: 0.5,
        sustain: 0.6,
        release: 2.0,
      },
    });

    // Detuned layer for thickness
    this.layer2 = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sawtooth",
        // @ts-expect-error not in ToneTypeOscillatorOptions
        count: 3,
        spread: 30,
      },
      envelope: {
        attack: 2.5,
        decay: 1.5,
        sustain: 0.7,
        release: 5.0,
      },
    });

    // Sub-harmonic layer for darkness
    this.layer3 = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 4.0,
        decay: 2.0,
        sustain: 0.9,
        release: 6.0,
      },
    });

    // Dark filter with slow LFO modulation
    this.filter = new Tone.Filter({
      frequency: 800,
      type: "lowpass",
      rolloff: -24,
      Q: 3,
    });

    this.filterLFO = new Tone.LFO({
      frequency: 0.08,
      min: 400,
      max: 1200,
      type: "sine",
    });
    this.filterLFO.connect(this.filter.frequency);

    // Secondary filter LFO for complexity
    this.filterLFO2 = new Tone.LFO({
      frequency: 0.03,
      min: -200,
      max: 200,
      type: "triangle",
    });
    this.filterLFO2.connect(this.filter.frequency);

    // Phaser for movement
    this.phaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350,
      Q: 10,
      wet: 0.4,
    });

    // Chorus for width
    this.chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 8,
      depth: 0.8,
      wet: 0.5,
    });

    // Stereo widener with auto-pan
    this.autoPanner = new Tone.AutoPanner({
      frequency: 0.05,
      depth: 0.6,
    });

    // Frequency shifter for otherworldly texture
    this.freqShifter = new Tone.FrequencyShifter({
      frequency: 0,
      wet: 0.3,
    });

    // Bit crusher for texture/grit (optional)
    this.bitCrusher = new Tone.BitCrusher({
      bits: 8,
    });

    // Massive reverb
    this.reverb = new Tone.Reverb({
      decay: 12,
      preDelay: 0.05,
      wet: 0.7,
    });

    // Reverb modulation LFO
    this.reverbLFO = new Tone.LFO({
      frequency: 0.04,
      min: 0.5,
      max: 0.9,
      type: "sine",
    });
    this.reverbLFO.connect(this.reverb.wet);

    // Volume LFO for breathing effect
    this.volumeLFO = new Tone.LFO({
      frequency: "12hz",
      min: 0.2,
      max: 1.0,
      type: "triangle",
    });

    // Layer gains for mixing
    this.layer1Gain = new Tone.Gain(0.2);
    this.layer2Gain = new Tone.Gain(0.15);
    this.layer3Gain = new Tone.Gain(0.125);

    // Master gain
    this.masterGain = new Tone.Gain(0.6);
    this.volumeLFO.connect(this.masterGain.gain);

    // Connect layer 1 (FM)
    this.layer1.chain(
      this.layer1Gain,
      this.filter,
      this.phaser,
      this.chorus,
      this.freqShifter,
      this.bitCrusher,
      this.autoPanner,
      this.reverb,
      this.masterGain,
      Tone.getDestination()
    );

    // Connect layer 2 (detuned)
    this.layer2.chain(this.layer2Gain, this.filter);

    // Connect layer 3 (sub)
    this.layer3.chain(this.layer3Gain, this.filter);

    this.reverb.generate();
    this.chorus.start();
    this.autoPanner.start();
  }

  async start() {
    this.filterLFO.start();
    this.filterLFO2.start();
    this.reverbLFO.start();
    this.volumeLFO.start();
  }

  // Play with optional sub-harmonic (octave down)
  playChord(
    notes: string | string[],
    duration = "4n",
    time: Tone.Unit.Time | undefined = undefined,
    withSub = true
  ): void {
    this.layer1.triggerAttackRelease(notes, duration, time);
    this.layer2.triggerAttackRelease(notes, duration, time);

    if (withSub) {
      const subNotes = Array.isArray(notes)
        ? notes.map((n) => Tone.Frequency(n).transpose(-12).toNote())
        : Tone.Frequency(notes).transpose(-12).toNote();
      this.layer3.triggerAttackRelease(subNotes, duration, time);
    }
  }

  playChordEternal(
    notes: string | string[],
    time: Tone.Unit.Time,
    withSub = true
  ): void {
    this.layer1.triggerAttack(notes, time);
    this.layer2.triggerAttack(notes, time);

    if (withSub) {
      const subNotes = Array.isArray(notes)
        ? notes.map((n) => Tone.Frequency(n).transpose(-12).toNote())
        : Tone.Frequency(notes).transpose(-12).toNote();
      this.layer3.triggerAttack(subNotes, time);
    }
  }

  releaseAll(): void {
    this.layer1.releaseAll();
    this.layer2.releaseAll();
    this.layer3.releaseAll();
  }

  setFilterCutoff(freq: number, rampTime = 2): void {
    this.filterLFO.set({
      min: freq - 200,
      max: freq + 400,
    });
  }

  setFilterLFORate(rate: number): void {
    this.filterLFO.frequency.value = rate;
  }

  setDarkness(amount: number): void {
    // 0-1: higher = darker
    const cutoff = 1200 - amount * 600;
    this.filter.frequency.value = cutoff;
  }

  setReverbAmount(wet: number): void {
    this.reverb.wet.value = wet;
  }

  setPhaserDepth(depth: number): void {
    this.phaser.wet.value = depth;
  }

  setChorusDepth(depth: number): void {
    this.chorus.wet.value = depth;
  }

  setFreqShift(hz: number): void {
    this.freqShifter.frequency.value = hz;
  }

  setBitCrush(amount: number): void {
    this.bitCrusher.wet.value = amount;
  }

  setLayerMix(layer1: number, layer2: number, layer3: number): void {
    this.layer1Gain.gain.value = layer1;
    this.layer2Gain.gain.value = layer2;
    this.layer3Gain.gain.value = layer3;
  }

  setBreathingRate(rate: Tone.Unit.Frequency): void {
    this.volumeLFO.frequency.value = rate;
  }

  setBreathingDepth(min: number, max: number): void {
    this.volumeLFO.min = min;
    this.volumeLFO.max = max;
  }

  dispose(): void {
    this.layer1.dispose();
    this.layer2.dispose();
    this.layer3.dispose();
    this.filter.dispose();
    this.filterLFO.dispose();
    this.filterLFO2.dispose();
    this.phaser.dispose();
    this.chorus.dispose();
    this.autoPanner.dispose();
    this.freqShifter.dispose();
    this.bitCrusher.dispose();
    this.reverb.dispose();
    this.reverbLFO.dispose();
    this.volumeLFO.dispose();
    this.layer1Gain.dispose();
    this.layer2Gain.dispose();
    this.layer3Gain.dispose();
    this.masterGain.dispose();
  }
}
