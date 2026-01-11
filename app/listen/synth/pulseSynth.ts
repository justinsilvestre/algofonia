import * as Tone from 'tone';

export class PulseSynth {
  private synth0: Tone.PolySynth<Tone.DuoSynth>;
  private synth1: Tone.PolySynth<Tone.AMSynth>;

  private filter: Tone.Filter;
  private filterLFO: Tone.LFO;
  private filterEnvelope: Tone.FrequencyEnvelope;

  private chorus: Tone.Chorus;
  private delay: Tone.PingPongDelay;

  private reverb: Tone.Reverb = new Tone.Reverb(3.5);
  private reverbLFO: Tone.LFO = new Tone.LFO(0.1, 0.1, 0.7);

  private gain: Tone.Gain;
  public gainLFO: Tone.LFO;
  public gainLFOLFO: Tone.LFO;

  constructor() {
    this.synth0 = new Tone.PolySynth(Tone.DuoSynth, {
      // @ts-expect-error -- not available with DuoSynth
      maxPolyphony: 4,
      oscillator: {
        type: 'triangle',
        count: 2,
        spread: 50,
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.6,
      },
    });

    this.synth1 = new Tone.PolySynth(Tone.AMSynth, {
      maxPolyphony: 4,
      oscillator: {
        type: 'sine',
        // @ts-expect-error -- no count on ToneTypeOscillatorOptions
        count: 2,
        spread: 50,
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.6,
      },
      detune: 720,
    });

    this.filter = new Tone.Filter({
      frequency: 4500,
      type: 'lowpass',
      rolloff: -12,
    });
    this.filterLFO = new Tone.LFO(16, 2000, 4500);
    this.filterLFO.connect(this.filter.frequency);

    this.filterEnvelope = new Tone.FrequencyEnvelope({
      attack: 0.01,
      decay: 0.2,
      sustain: 0.5,
      release: 0.6,
      baseFrequency: 4500,
      octaves: 4,
    });
    this.filterEnvelope.connect(this.filter.frequency);

    // Chorus for thickness
    this.chorus = new Tone.Chorus({
      frequency: 15,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.3,
    });

    this.delay = new Tone.PingPongDelay({
      delayTime: '8t',
      feedback: 0.5,
      wet: 0.9,
    });

    // Reverb for ambient space
    // this.reverb = new Tone.Reverb({
    //     decay    : 4
    //   , preDelay : 0.1
    //   , wet      : 0.7
    // });
    // this.reverbLFO = new Tone.LFO(0.8, 0, 1);
    // this.reverbLFO.connect(this.reverb.wet);

    // Gain node for LFO modulation (tremolo effect)
    this.gain = new Tone.Gain(0.25);
    this.gainLFO = new Tone.LFO({
      frequency: 2,
      min: 0,
      max: 0.125 / 2,
      type: 'triangle',
    });
    this.gainLFO.phase = 90;
    this.gainLFO.connect(this.gain.gain);

    // LFO which modulates the LFO
    this.gainLFOLFO = new Tone.LFO({
      frequency: 0.1,
      min: 2,
      max: 16,
      type: 'sine',
    });
    this.gainLFOLFO.connect(this.gainLFO.frequency);

    // Connect the chain
    this.synth0.chain(
      this.filter,
      this.chorus,
      this.delay,
      this.gain,
      Tone.Destination
    );
    this.synth1.chain(
      this.filter,
      this.chorus,
      this.delay,
      this.gain,
      Tone.Destination
    );
  }
  async start(): Promise<void> {
    this.filterLFO.start();
    // this.reverbLFO.start();
    this.gainLFO.start();
    this.gainLFOLFO.start();
    this.chorus.start();
    // this.reverb.generate();
  }

  playChord(
    notes: Tone.Unit.Frequency[],
    duration: Tone.Unit.Time = '2n',
    time?: Tone.Unit.Time
  ): void {
    this.synth0.triggerAttackRelease(notes, duration, time);
    this.synth1.triggerAttackRelease(notes, duration, time);

    this.filterEnvelope.triggerAttackRelease(duration, time);
  }

  playChordEternal(notes: Tone.Unit.Frequency[], time?: Tone.Unit.Time): void {
    this.synth0.triggerAttack(notes, time);
    this.synth1.triggerAttack(notes, time);

    this.filterEnvelope.triggerAttack(time);
  }

  stop(): void {
    Tone.getTransport().stop();
  }

  dispose(): void {
    this.synth0.dispose();
    this.synth1.dispose();

    this.filter.dispose();
    this.filterLFO.dispose();
    this.filterEnvelope.dispose();

    this.chorus.dispose();
    this.delay.dispose();

    // this.reverb.dispose();
    // this.reverbLFO.dispose();

    this.gain.dispose();
    this.gainLFO.dispose();
    this.gainLFOLFO.dispose();
  }
}
