import * as Tone from "tone";
import { createChannel, ToneControls } from "../tone";
import { Scale } from "tonal";

const octave = 3;

function getLoop(tone: ToneControls, padSynth: ReturnType<typeof getPadSynth>) {
  const { currentMeasureStartTime, key, mode } = tone;
  const scale = `${key}${octave} ${mode}`;
  const scaleNotes = Scale.get(scale).notes;
  const chordNotes = [scaleNotes[0], scaleNotes[3], scaleNotes[5]];
  const loop = new Tone.Loop((time) => {
    padSynth.fmSynth.releaseAll(time);
    padSynth.fmSynth.triggerAttack(chordNotes, time);
  }, "1m");
  loop.start(currentMeasureStartTime);
  return { loop, chordNotes };
}

export const padSynth = createChannel({
  key: "Pad Synth",
  initialize: (tone) => {
    const padSynth = getPadSynth();
    const loop = getLoop(tone, padSynth);

    return {
      padSynth,
      loop,
    };
  },
  teardown: ({ padSynth, loop }) => {
    padSynth.dispose();
    loop.loop.dispose();
  },
  respond: (
    { key, mode, currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { padSynth } = getState();

    // Control effects based on inputs
    // 10 to 30
    const modulationIndex = 10 + (frontToBack / 100) * 20;
    // 1.5 to 2.5
    const harmonicity = 1.5 + (around / 100) * 1.0;

    padSynth.fmSynth.set({
      modulationIndex,
      harmonicity,
    });

    // Update chord notes based on current key/mode
    const scale = `${key}${octave} ${mode}`;
    const scaleNotes = Scale.get(scale).notes;
    const newChordNotes = [scaleNotes[0], scaleNotes[3], scaleNotes[5]];

    const currentState = getState();
    const notesChanged =
      JSON.stringify(newChordNotes) !==
      JSON.stringify(currentState.loop.chordNotes);

    if (notesChanged) {
      // Restart loop with new notes
      currentState.loop.loop.dispose();

      const newLoop = getLoop(
        { key, mode, currentMeasureStartTime } as ToneControls,
        padSynth
      );

      setState((state) => ({
        ...state,
        loop: newLoop,
      }));
    }
  },
  renderMonitorDisplay: (channelState) => {
    const modulationIndex = channelState.padSynth.fmSynth.get().modulationIndex;
    const harmonicity = channelState.padSynth.fmSynth.get().harmonicity;

    return (
      <div className="flex-1 text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Modulation Index</span>
            <span className="font-mono text-base text-red-400">
              {modulationIndex}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Harmonicity</span>
            <span className="font-mono text-base text-green-400">
              {harmonicity}
            </span>
          </div>
        </div>
      </div>
    );
  },
});

function getPadSynth() {
  const fmSynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 8,
    oscillator: {
      type: "sine",
    },
    envelope: {
      attack: "16n",
      decay: 1.0,
      sustain: 0.8,
      release: 4.0,
    },
    modulation: {
      type: "triangle",
    },
    modulationEnvelope: {
      attack: "8n",
      decay: 0.5,
      sustain: 0.6,
      release: 2.0,
    },
  });

  const phaser = new Tone.Phaser({
    frequency: 0.5,
    octaves: 3,
    baseFrequency: 350,
    Q: 10,
    wet: 0.4,
  });
  const chorus = new Tone.Chorus({
    frequency: 0.5,
    delayTime: 8,
    depth: 0.8,
    wet: 0.5,
  });

  // Volume LFO for breathing effect
  const volumeLFO = new Tone.LFO({
    frequency: "12hz",
    min: 0.05,
    max: 0.5,
    type: "triangle",
  });
  const masterGain = new Tone.Gain(0.2);
  volumeLFO.connect(masterGain.gain);

  fmSynth.chain(phaser, chorus, masterGain, Tone.getDestination());

  chorus.start();
  volumeLFO.start();

  return {
    fmSynth,
    dispose: () => {
      phaser.dispose();
      fmSynth.dispose();
      chorus.dispose();
      masterGain.dispose();
      volumeLFO.dispose();
    },
  };
}
