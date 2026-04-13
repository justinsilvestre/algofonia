import * as Tone from "tone";

export class ProximityMelody {
  synth: Tone.PolySynth<Tone.FMSynth>;
  reverb: Tone.Reverb;
  chorus: Tone.Chorus;
  pingPong: Tone.PingPongDelay;
  filter: Tone.Filter;
  gain: Tone.Gain;

  constructor(masterVolume: number) {
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      // compiler error:
      // maxpolyphony: 4,
      harmonicity: 1,
      modulationIndex: 1.2,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.02,
        decay: 0.8,
        sustain: 0.1,
        release: 2.5,
      },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.4,
        sustain: 0.2,
        release: 1.5,
      },
    });

    // Set max polyphony after construction
    this.synth.maxPolyphony = 4;

    this.reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.4,
    });

    this.chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 3,
      depth: 0.3,
      wet: 0.25,
    }).start();

    this.pingPong = new Tone.PingPongDelay({
      feedback: 0.4,
      delayTime: "16t",
    });

    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: 2500,
      rolloff: -12,
    });

    this.gain = new Tone.Gain(masterVolume);

    this.synth.chain(
      this.chorus,
      this.filter,
      this.pingPong,
      this.reverb,
      this.gain,
      Tone.getDestination()
    );
  }

  dispose(): void {
    this.synth.dispose();
    this.reverb.dispose();
    this.chorus.dispose();
    this.filter.dispose();
    this.gain.dispose();
  }
}
