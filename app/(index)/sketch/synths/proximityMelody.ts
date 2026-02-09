import * as Tone from "tone";
import { map } from "./map";
import { constrain } from "./constrain";

export class ProximityMelody {
  synth: Tone.PolySynth<Tone.FMSynth>;
  reverb: Tone.Reverb;
  chorus: Tone.Chorus;
  pingPong: Tone.PingPongDelay;
  filter: Tone.Filter;
  gain: Tone.Gain;
  melodyPatterns: string[][];
  currentPattern: string[];
  repeatId: number | null;
  proximityLevel: number;

  constructor(scaleOctaveAbove: string[]) {
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

    this.gain = new Tone.Gain(0.0);

    this.synth.chain(
      this.chorus,
      this.filter,
      this.pingPong,
      this.reverb,
      this.gain,
      Tone.getDestination()
    );

    this.melodyPatterns = [
      [scaleOctaveAbove[4], scaleOctaveAbove[2], scaleOctaveAbove[0]],
      [scaleOctaveAbove[0], scaleOctaveAbove[2], scaleOctaveAbove[5]],
      [
        scaleOctaveAbove[5],
        scaleOctaveAbove[4],
        scaleOctaveAbove[3],
        scaleOctaveAbove[2],
      ],
      [scaleOctaveAbove[0], scaleOctaveAbove[4]],
      [scaleOctaveAbove[2], scaleOctaveAbove[6], scaleOctaveAbove[4]],
    ];

    this.currentPattern = randomChoice(this.melodyPatterns);
    this.repeatId = null;
    this.proximityLevel = 1;
  }

  start(): void {
    if (this.repeatId) return;

    let noteIndex = 0;

    this.repeatId = Tone.Transport.scheduleRepeat((time: number) => {
      const activePositions = [0, 5, 10, 14].slice(
        0,
        this.currentPattern.length
      );
      const position = noteIndex % 16;

      if (activePositions.includes(position)) {
        const patternIndex = activePositions.indexOf(position);
        let note = this.currentPattern[patternIndex];

        if (this.proximityLevel > 0.1) {
          // const velocity = map(this.proximityLevel, 0.1, 1, 0.2, 0.6); // Unused variable commented out

          if (Math.random() > 0.7)
            note = Tone.Frequency(note)
              .transpose(Math.random() > 0.5 ? 12 : -12)
              .toNote();

          this.synth.triggerAttackRelease(note, "8n", time);
        }
      }

      noteIndex++;

      if (noteIndex % 32 === 0 && Math.random() < 0.3) {
        this.currentPattern = randomChoice(this.melodyPatterns);
      }
    }, "16n");
  }

  update(
    visitorIndex1: number,
    visitorIndex2: number,
    distance: number,
    masterVolume: number
  ): void {
    const volume =
      map(constrain(distance, 0, 200), 0, 200, 0.4, 0.0) * masterVolume;
    this.gain.gain.rampTo(volume, 0.1);
  }

  stop(): void {
    if (this.repeatId) {
      Tone.Transport.clear(this.repeatId);
      this.repeatId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.synth.dispose();
    this.reverb.dispose();
    this.chorus.dispose();
    this.filter.dispose();
    this.gain.dispose();
  }
}

// Helper method to replace p5.js random function
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
