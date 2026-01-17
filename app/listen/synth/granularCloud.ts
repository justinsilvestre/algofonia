import * as Tone from "tone";

export class GranularCloud {
  private buffer: Tone.ToneAudioBuffer;

  private grainPlayer1: Tone.GrainPlayer;
  private grainPlayer2: Tone.GrainPlayer;
  private grainPlayer3: Tone.GrainPlayer;

  private positionLFO: Tone.LFO;
  private positionLFO2: Tone.LFO;
  private grainSizeLFO: Tone.LFO;

  private filter: Tone.Filter;
  private filterLFO: Tone.LFO;

  private reverb: Tone.Reverb;
  private chorus: Tone.Chorus;
  private autoPanner: Tone.AutoPanner;

  private volumeLFO: Tone.LFO;
  private grain1Gain: Tone.Gain;
  private grain2Gain: Tone.Gain;
  private grain3Gain: Tone.Gain;
  private masterGain: Tone.Gain;

  constructor(sampleUrl: string) {
    this.buffer = new Tone.ToneAudioBuffer(sampleUrl);

    // Multiple grain players for thick cloud
    this.grainPlayer1 = new Tone.GrainPlayer({
      url: sampleUrl,
      loop: true,
      grainSize: 0.2,
      overlap: 0.5,
      reverse: true,
    });

    this.grainPlayer2 = new Tone.GrainPlayer({
      url: sampleUrl,
      loop: true,
      grainSize: 0.15,
      overlap: 0.6,
    });

    this.grainPlayer3 = new Tone.GrainPlayer({
      url: sampleUrl,
      loop: true,
      grainSize: 0.25,
      overlap: 0.4,
    });

    // Subtle detuning for richness
    this.grainPlayer2.detune = -7;
    this.grainPlayer3.detune = 5;

    // Very slow LFO to drift through the sample
    this.positionLFO = new Tone.LFO({
      frequency: 0.03,
      min: 0,
      max: 1,
      type: "sine",
    });

    // Secondary slower LFO for even more drift
    this.positionLFO2 = new Tone.LFO({
      frequency: 0.01,
      min: -0.2,
      max: 0.2,
      type: "triangle",
    });

    // Grain size modulation for breathing effect
    this.grainSizeLFO = new Tone.LFO({
      frequency: 0.05,
      min: 0.1,
      max: 0.3,
      type: "sine",
    });

    // Dark filter for atmospheric quality
    this.filter = new Tone.Filter({
      frequency: 1200,
      type: "lowpass",
      rolloff: -24,
      Q: 2,
    });

    // Filter modulation
    this.filterLFO = new Tone.LFO({
      frequency: 0.08,
      min: 800,
      max: 1800,
      type: "sine",
    });
    this.filterLFO.connect(this.filter.frequency);

    // Reverb for space
    this.reverb = new Tone.Reverb({
      decay: 12,
      wet: 0.7,
    });

    // Chorus for width
    this.chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 8,
      depth: 0.8,
      wet: 0.5,
    });

    // Auto-panner for movement
    this.autoPanner = new Tone.AutoPanner({
      frequency: 0.04,
      depth: 0.6,
    });

    // Volume LFO for breathing
    this.volumeLFO = new Tone.LFO({
      frequency: 0.06,
      min: 0.6,
      max: 1.0,
      type: "sine",
    });

    // Individual gains for mixing
    this.grain1Gain = new Tone.Gain(0.5);
    this.grain2Gain = new Tone.Gain(0.35);
    this.grain3Gain = new Tone.Gain(0.4);

    // Master gain
    this.masterGain = new Tone.Gain(1);
    this.volumeLFO.connect(this.masterGain.gain);

    // Thorws an error right now, have to figure out how to make it work.

    // Connect LFOs to grain players
    // this.positionLFO.connect(this.grainPlayer1.playbackRate);
    // this.positionLFO.connect(this.grainPlayer2.playbackRate);
    // this.positionLFO.connect(this.grainPlayer3.playbackRate);

    // this.positionLFO2.connect(this.grainPlayer1.playbackRate);
    // this.positionLFO2.connect(this.grainPlayer2.playbackRate);
    // this.positionLFO2.connect(this.grainPlayer3.playbackRate);

    // this.grainSizeLFO.connect(this.grainPlayer1.grainSize);
    // this.grainSizeLFO.connect(this.grainPlayer2.grainSize);
    // this.grainSizeLFO.connect(this.grainPlayer3.grainSize);

    // Connect grain player 1
    this.grainPlayer1.chain(
      this.grain1Gain,
      this.filter,
      this.autoPanner,
      this.reverb,
      this.masterGain,
      Tone.getDestination()
    );

    // Connect other grain players to filter
    this.grainPlayer2.chain(this.grain2Gain, this.filter);

    this.grainPlayer3.chain(this.grain3Gain, this.filter);

    // this.reverb.generate();
    this.chorus.start();
    this.autoPanner.start();
  }

  async start() {
    await Tone.loaded();

    this.grainPlayer1.start();
    this.grainPlayer2.start();
    this.grainPlayer3.start();

    // this.positionLFO.start();
    // this.positionLFO2.start();
    // this.grainSizeLFO.start();
    this.filterLFO.start();
    this.volumeLFO.start();
  }

  stop() {
    this.grainPlayer1.stop();
    this.grainPlayer2.stop();
    this.grainPlayer3.stop();
  }

  // Freeze at specific position (0-1)
  freezeAt(position: number) {
    this.positionLFO.stop();
    this.positionLFO2.stop();

    this.grainPlayer1.playbackRate = 0;
    this.grainPlayer2.playbackRate = 0;
    this.grainPlayer3.playbackRate = 0;

    // Seek to position
    const time = position * this.buffer.duration;
    // @ts-expect-error -- no seek method on GrainPlayer
    this.grainPlayer1.seek(position);
    // @ts-expect-error -- no seek method on GrainPlayer
    this.grainPlayer2.seek(position);
    // @ts-expect-error -- no seek method on GrainPlayer
    this.grainPlayer3.seek(position);
  }

  // Unfreeze and resume drifting
  unfreeze() {
    this.positionLFO.start();
    this.positionLFO2.start();
  }

  // Set drift speed
  setDriftSpeed(speed: number) {
    this.positionLFO.frequency.value = speed;
    this.positionLFO2.frequency.value = speed * 0.3;
  }

  // Set grain size range
  setGrainSize(min: number, max: number) {
    this.grainSizeLFO.min = min;
    this.grainSizeLFO.max = max;
  }

  // Set darkness (filter cutoff)
  setDarkness(amount: number) {
    const cutoff = 2000 - amount * 1200;
    this.filter.frequency.value = cutoff;
  }

  // Set cloud density (overlap)
  setDensity(amount: number) {
    this.grainPlayer1.overlap = amount;
    this.grainPlayer2.overlap = amount * 1.2;
    this.grainPlayer3.overlap = amount * 0.8;
  }

  dispose() {
    this.grainPlayer1.dispose();
    this.grainPlayer2.dispose();
    this.grainPlayer3.dispose();
    // this.positionLFO.dispose();
    // this.positionLFO2.dispose();
    // this.grainSizeLFO.dispose();
    this.filter.dispose();
    this.filterLFO.dispose();
    this.reverb.dispose();
    this.chorus.dispose();
    this.autoPanner.dispose();
    this.volumeLFO.dispose();
    this.grain1Gain.dispose();
    this.grain2Gain.dispose();
    this.grain3Gain.dispose();
    this.masterGain.dispose();
  }
}
