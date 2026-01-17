import * as Tone from "tone";

export class PluckSynth {
  private synth: Tone.Synth;

  private filter: Tone.Filter;
  private pingPong: Tone.PingPongDelay;
  private reverb: Tone.Reverb;

  private gain: Tone.Gain;

  constructor() {
    this.synth = new Tone.Synth({
      oscillator: {
        type: "square",
      },
      envelope: {
        attack: 0.01,
        decay: 0.05,
        sustain: 0,
        release: 0.8,
      },
      detune: -12 * 1,
    });

    // Bright filter with resonance for that plucky character
    this.filter = new Tone.Filter({
      frequency: 350,
      type: "lowpass",
      rolloff: -12,
      Q: 5,
    });

    // Ping pong delay for stereo width
    this.pingPong = new Tone.PingPongDelay({
      delayTime: "16t",
      feedback: 0.6,
      wet: 0.25,
    });

    // Short reverb for space
    this.reverb = new Tone.Reverb({
      decay: 1.5,
      wet: 0.2,
    });

    this.gain = new Tone.Gain(0.4);

    this.synth.chain(
      this.filter,
      this.pingPong,
      this.reverb,
      this.gain,
      Tone.Destination
    );
    this.reverb.generate();
  }
  async start(): Promise<void> {
    await Tone.start();
  }

  playNote(
    note: Tone.Unit.Frequency,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time
  ): void {
    this.synth.triggerAttackRelease(note, duration, time);
  }

  dispose(): void {
    this.synth.dispose();
    this.filter.dispose();
    this.pingPong.dispose();
    this.reverb.dispose();
  }
}
