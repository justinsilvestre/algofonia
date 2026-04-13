import * as Tone from "tone";
import { map } from "../map";
import { constrain } from "./constrain";

export class PoemSampler {
  isLoaded: boolean;
  sampler: Tone.Sampler;
  notes: string[];
  noteIndex: number;
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  filter: Tone.Filter;
  filterLFO: Tone.LFO;
  panner: Tone.Panner;
  stereoWidener: Tone.StereoWidener;
  compressor: Tone.Compressor;
  gain: Tone.Gain;

  constructor(masterVolume: number) {
    this.isLoaded = false;

    // Use 'this.sampler' instead of bare 'sampler'
    this.sampler = new Tone.Sampler({
      urls: {
        A1: "/samples/p1.mp3", // Use full URL with correct port and endpoint
        B1: "/samples/p2.mp3",
        C1: "/samples/p3.mp3",
        D1: "/samples/p4.mp3",
      },
      onload: () => {
        this.isLoaded = true;
        console.log("Poem samples loaded.");
      },
    });

    this.notes = ["A1", "B1", "C1", "D1"];
    this.noteIndex = 0;

    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.3,
    });

    this.delay = new Tone.FeedbackDelay({
      feedback: 0.3,
      delayTime: "8n.",
      wet: 0.4,
    });

    this.filter = new Tone.Filter({
      frequency: 6000,
      type: "lowpass",
    });

    this.filterLFO = new Tone.LFO({
      frequency: 0.1,
      min: 2000,
      max: 6000,
    });
    this.filterLFO.connect(this.filter.frequency);
    this.filterLFO.start();

    this.panner = new Tone.Panner(0.0);
    // Stereo widener for immersive space
    this.stereoWidener = new Tone.StereoWidener(0.8);

    // Compressor to glue everything
    this.compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
      attack: 0.1,
      release: 0.3,
    });

    this.gain = new Tone.Gain(0.45 * masterVolume);

    this.sampler.chain(
      this.filter,
      this.reverb,
      this.stereoWidener,
      // this.delay,
      this.compressor,
      this.panner,
      this.gain,
      Tone.getDestination()
    );
  }

  update(screenCentroidX: number, width: number): void {
    this.panner.pan.rampTo(
      constrain(map(screenCentroidX, width * 0.45, width * 0.55, -1, 1), -1, 1),
      0.1
    );
  }

  // Trigger the next poem line
  trigger(time: Tone.Unit.Time): void {
    if (!this.isLoaded) return;

    this.sampler.triggerAttackRelease(this.notes[this.noteIndex], "1n", time);

    this.noteIndex += 1;
    this.noteIndex %= 4;
  }

  // Trigger specific line
  triggerLine(lineNumber: number, time: Tone.Unit.Time): void {
    if (!this.isLoaded) return;
    if (lineNumber < 1 || lineNumber > 4) return;

    const notes = ["A1", "B1", "C1", "D1"];
    this.sampler.triggerAttackRelease(notes[lineNumber - 1], "1n", time);
  }

  dispose(): void {
    this.sampler.dispose();
  }
}
