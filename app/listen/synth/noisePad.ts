import * as Tone from 'tone';

export class NoisePad {
  private noise: Tone.Noise;

  private filter: Tone.Filter;
  private filterLFO: Tone.LFO;

  private grainShift: Tone.PitchShift;
  private reverb: Tone.Reverb;
  private phaser: Tone.Phaser;
  private autoPanner: Tone.AutoPanner;
  private gain: Tone.Gain;

  constructor() {
    const baseCutoff = 1900;
    const lfoDepth = 800;
    // Create pink noise source (warmer than white noise)
    this.noise = new Tone.Noise('pink');

    // Resonant bandpass filter for shaping the noise
    this.filter = new Tone.Filter({
      frequency: baseCutoff,
      type: 'lowpass',
      rolloff: -12,
      Q: 4,
    });

    // Slow LFO to modulate the filter cutoff
    this.filterLFO = new Tone.LFO({
      frequency: 0.55,
      min: baseCutoff - lfoDepth,
      max: baseCutoff + lfoDepth,
      type: 'sine',
    });

    // Grain delay for texture (creates pitch shifting artifacts)
    this.grainShift = new Tone.PitchShift({
      pitch: 0.0,
      windowSize: 0.1,
      delayTime: 0.0,
      feedback: 0.0,
    });

    // Lush reverb for space
    this.reverb = new Tone.Reverb({
      decay: 8,
      preDelay: 0.02,
      wet: 0.6,
    });

    this.phaser = new Tone.Phaser({
      frequency: 9,
      octaves: 4,
      baseFrequency: baseCutoff,
    });

    this.autoPanner = new Tone.AutoPanner({
      frequency: 0.1,
      depth: 0.7,
    }).start();

    // Volume control
    this.gain = new Tone.Gain(0.125);

    // Connect the signal chain
    this.noise.chain(
      this.filter,
      this.grainShift,
      this.autoPanner,
      this.reverb,
      this.phaser,
      this.gain,
      Tone.Destination
    );

    // Connect LFO to filter frequency
    this.filterLFO.connect(this.filter.frequency);

    // Generate reverb impulse response
    this.reverb.generate();
  }

  async start(): Promise<void> {
    this.noise.start();
    this.filterLFO.start();
  }

  stop(): void {
    this.noise.stop();
    this.filterLFO.stop();
  }

  setPitchShift(semitones: number): void {
    this.grainShift.pitch = semitones;
  }

  setAutoPannerRate(rate: number): void {
    this.autoPanner.frequency.value = rate;
  }

  dispose(): void {
    this.noise.dispose();
    this.filter.dispose();
    this.filterLFO.dispose();
    this.grainShift.dispose();
    this.reverb.dispose();
    this.phaser.dispose();
    this.autoPanner.dispose();
    this.gain.dispose();
  }
}
