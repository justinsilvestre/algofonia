import * as Tone from "tone";
import * as Tonal from "tonal";
import { defineSoundModule } from "../tone";
import { AbstractHummingSampler } from "../instruments/finalExhibition/abstractHumSampler";
import { ArpeggioHumSampler } from "../instruments/finalExhibition/arpeggioHumSampler";
import { BassSynth } from "../instruments/finalExhibition/bass";
import { DarkAmbientPad } from "../instruments/finalExhibition/darkPad";
import { PoemSampler } from "../instruments/finalExhibition/poemSampler";
import { ProximityMelody } from "../instruments/finalExhibition/proximityMelody";
import { map } from "../instruments/map";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";

export const abstractHumSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    const sampler = new AbstractHummingSampler("/samples/humming.mp3");
    return {
      state: { volume: masterVolume, currentEntropy: 0 },
      controls: { sampler },
    };
  },
  teardown: ({ sampler }) => sampler.dispose(),
  onToneEvent: {
    entropyUpdate: (controls, state, tone, entropy) => {
      controls.sampler.updateWaves(entropy, state.volume, Tone.now());
    },
  },
});

export const arpeggioHumSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    const sampler = new ArpeggioHumSampler(
      "/samples/humming.mp3",
      masterVolume
    );
    return {
      state: { volume: masterVolume },
      controls: { sampler },
    };
  },
  teardown: ({ sampler }) => sampler.dispose(),
  onToneEvent: {
    entropyUpdate: (controls, state, tone, entropy) => {
      controls.sampler.update(entropy);
    },
  },
});

export const bass = defineSoundModule({
  initialize: ({ masterVolume }) => {
    const synth = new BassSynth(masterVolume);
    return {
      state: { volume: masterVolume, lastState: 0 },
      controls: { synth },
    };
  },
  teardown: ({ synth }) => synth.dispose(),
  onToneEvent: {
    entropyUpdate: (controls, state, tone, entropy, setState) => {
      const scaleNotes = Tonal.Scale.get(`${tone.tonic}3 ${tone.scale}`).notes;

      // Contraction: Trigger Tonic
      if (entropy < 0.05 && state.lastState !== -1) {
        console.log("Bass: Triggering Tonic");
        controls.synth.playNote(scaleNotes[0], "1n");
        setState({ ...state, lastState: -1 });
      }
      // Expansion: Trigger Mediant (3rd degree)
      else if (entropy > 0.15 && state.lastState !== 1) {
        console.log("Bass: Triggering Mediant");
        controls.synth.playNote(scaleNotes[2], "1n");
        setState({ ...state, lastState: 1 });
      }
    },
  },
});

export const darkPad = defineSoundModule({
  initialize: ({ masterVolume, tonic, scale }) => {
    const pad = new DarkAmbientPad(masterVolume);
    const scaleNotes = Tonal.Scale.get(`${tonic}3 ${scale}`).notes;
    const volumeGates = scaleNotes.map(() => new Tone.Gain(0));

    scaleNotes.forEach((note, i) => {
      pad.createVoice(note, volumeGates[i]);
    });

    return {
      state: { volume: masterVolume },
      controls: { pad, volumeGates },
    };
  },
  teardown: ({ pad, volumeGates }) => {
    volumeGates.forEach((g: Tone.Gain) => g.dispose());
    pad.dispose();
  },
  onToneEvent: {
    sliceActive: (controls, state, tone, { index, density }) => {
      console.log("Slice active event:", index, density);
      const gate = controls.volumeGates[index];
      if (gate) {
        // Ramp volume based on density threshold
        const targetVol = map(density, 500, 5000, 0, 0.15) * state.volume;
        gate.gain.rampTo(map(targetVol, 0, 0.2, 0, 0.2), 0.2);
      }
    },
  },
});

const poemSampleNames = ["sample 1", "sample 2", "sample 3", "sample 4"];

export const poemSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    const sampler = new PoemSampler(masterVolume);
    return {
      state: {
        volume: masterVolume,
        cooldownMs: 2000,
        currentSample: "-",
        cooldownProgress: 0,
        lastTriggerTime: 0,
      },
      controls: {
        sampler,
        lastTriggerTime: 0,
        cooldownTimerRef: null as ReturnType<typeof setInterval> | null,
      },
    };
  },

  teardown: ({ sampler, cooldownTimerRef }) => {
    if (cooldownTimerRef) {
      clearInterval(cooldownTimerRef);
    }
    sampler.dispose();
  },

  onToneEvent: {
    centroidMove: (controls, state, tone, x) => {
      controls.sampler.update(x, 1920);
    },

    poemTrigger: (controls, state, tone, arg, setState) => {
      const currentTime = Tone.now();

      if (currentTime - controls.lastTriggerTime >= state.cooldownMs / 1000) {
        // --- PREVENTION OF CLIPPING ---
        // Force the release of any currently playing notes before starting the next
        // This prevents the gain from stacking and causing clipping.
        controls.sampler.sampler.releaseAll(currentTime);

        // Trigger with a small fade to avoid DC offset clicks
        controls.sampler.trigger(currentTime + 0.05);

        // Update state with new sample info
        const sampleIndex = (controls.sampler.noteIndex - 1 + 4) % 4; // Get the sample that was just triggered
        const sampleName = poemSampleNames[sampleIndex];

        setState({
          ...state,
          currentSample: sampleName,
          cooldownProgress: 1,
          lastTriggerTime: currentTime,
        });

        controls.lastTriggerTime = currentTime;

        // Clear any existing timer
        if (controls.cooldownTimerRef) {
          clearInterval(controls.cooldownTimerRef);
        }

        // Start cooldown progress animation
        controls.cooldownTimerRef = setInterval(() => {
          const elapsed = (Tone.now() - controls.lastTriggerTime) * 1000;
          const progress = Math.max(0, 1 - elapsed / state.cooldownMs);

          setState((prevState) => ({
            ...prevState,
            currentSample: sampleName,
            cooldownProgress: progress,
          }));

          if (progress <= 0) {
            if (controls.cooldownTimerRef) {
              clearInterval(controls.cooldownTimerRef);
              controls.cooldownTimerRef = null;
            }
            setState((prevState) => ({
              ...prevState,
              currentSample: "-",
              cooldownProgress: 0,
            }));
          }
        }, 50); // Update every 50ms for smooth animation
      }
    },
  },

  renderMonitorDisplay: (state) => {
    const cooldownWidthPercent = state.cooldownProgress * 100;

    return (
      <SoundModuleDisplay
        title="Poem Sampler"
        className="w-100"
        boxContents={
          <div className="space-y-2">
            <SoundModuleDisplayItem
              className="[&>.value]:text-purple-400"
              label="Current Sample"
              value={state.currentSample}
            />
            <SoundModuleDisplayItem
              label="Cooldown"
              value={
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-75 ease-linear"
                    style={{ width: `${cooldownWidthPercent}%` }}
                  />
                </div>
              }
            />
          </div>
        }
        bottom={null}
      />
    );
  },
});

// Define rhythmic patterns using scale degrees and time
type MelodyStep = { time: Tone.Unit.Time; degree: number };

// prettier-ignore
const patterns: Record<string, MelodyStep[]> = {
  A: [{ time: "0:0:0", degree: 4 }, { time: "0:0:5", degree: 2 }, { time: "0:0:10", degree: 0 }],
  B: [{ time: "0:0:0", degree: 0 }, { time: "0:0:5", degree: 2 }, { time: "0:0:10", degree: 5 }],
  C: [{ time: "0:0:0", degree: 5 }, { time: "0:0:5", degree: 4 }, { time: "0:0:10", degree: 3 }, { time: "0:0:14", degree: 2 }],
  D: [{ time: "0:0:0", degree: 0 }, { time: "0:0:5", degree: 4 }],
  E: [{ time: "0:0:0", degree: 2 }, { time: "0:0:6", degree: 6 }, { time: "0:0:10", degree: 4 }],
};

export const proximityMelody = defineSoundModule({
  initialize: ({ masterVolume, emit }) => {
    const melody = new ProximityMelody(masterVolume);

    // Initial 2-measure loop to trigger the "change" event
    const repeat = Tone.getTransport().scheduleRepeat((time) => {
      Tone.getDraw().schedule(() => {
        console.log(
          "maybe Emitting proximityMelodyChange from scheduled repeat"
        );

        // Logic: noteIndex % 32 === 0 (every 2 measures)
        if (Math.random() < 0.3) {
          console.log("Emitting proximityMelodyChange from scheduled repeat");
          emit("proximityMelodyChange");
        }
      }, time);
    }, "2m");

    return {
      state: {
        distances: {} as Record<string, number>,
        currentPatternKey: "A" as keyof typeof patterns,
        maxProximity: 200,
        closePairs: [] as string[],
        proximityLevel: 0,
      },
      controls: {
        melody,
        repeat,
        part: null as Tone.Part | null,
      },
    };
  },

  teardown: ({ melody, part, repeat }) => {
    melody.dispose();
    part?.dispose();
    if (repeat) {
      Tone.getTransport().clear(repeat);
    }
  },
  onToneEvent: {
    // 1. Handle the proximity/volume logic
    proximityMapUpdate: (controls, state, tone, proximityMap, setState) => {
      const distances = Object.values(proximityMap);
      const minD =
        distances.length > 0 ? Math.min(...distances) : state.maxProximity;
      const proximityLevel = 1 - Math.min(minD / state.maxProximity, 1);

      // Map proximity to original volume range (0.4 max)
      const vol = proximityLevel * 0.4 * tone.masterVolume;
      controls.melody.gain.gain.rampTo(vol, 0.1);

      const closePairs = Object.entries(proximityMap)
        .filter(([_, d]) => d < state.maxProximity)
        .map(([pair, d]) => `${pair} (${Math.round(d)})`);

      setState((s) => ({
        ...s,
        closePairs,
        proximityLevel,
        distances: proximityMap,
      }));
    },

    // 2. Handle the pattern swap requested via emit
    proximityMelodyChange: (controls, state, tone, _, setState) => {
      const keys = Object.keys(patterns) as (keyof typeof patterns)[];
      const next = keys[Math.floor(Math.random() * keys.length)];

      setState((s) => ({ ...s, currentPatternKey: next }));
    },
  },

  onStateChange: (tone, controls, state, prevState) => {
    const { melody } = controls;

    if (state.currentPatternKey !== prevState.currentPatternKey) {
      console.log(`Changing pattern to ${state.currentPatternKey}`);
      // Dispose the old part to sync with the new pattern
      controls.part?.dispose();

      controls.part = new Tone.Part<MelodyStep>((time, step) => {
        // Logic from old code: transposition and proximity gates
        if (state.proximityLevel > 0.05) {
          const scale = Tonal.Scale.get(`${tone.tonic}5 ${tone.scale}`).notes;
          let noteName = scale[step.degree % scale.length];

          // 30% chance for octave jump
          if (Math.random() > 0.7) {
            noteName = Tonal.Note.transpose(
              noteName,
              Math.random() > 0.5 ? "P8" : "-P8"
            );
          }

          // Proximity-based velocity: 0.2 to 0.6
          const velocity = 0.2 + state.proximityLevel * 0.4;
          melody.synth.triggerAttackRelease(noteName, "8n", time, velocity);
        }
      }, patterns[state.currentPatternKey]);

      controls.part.loop = true;
      controls.part.loopEnd = "1m"; // The pattern itself is a 1-measure grid
      controls.part.start(tone.currentMeasureStartTime);
    }
  },

  renderMonitorDisplay: (state) => (
    <SoundModuleDisplay
      title="Proximity Melody"
      className="h-full"
      boxContents={
        <div className="space-y-2">
          <SoundModuleDisplayItem
            label="Current pattern"
            value={state.currentPatternKey}
          />
          <SoundModuleDisplayItem
            label="Close pairs"
            className="h-[5em]"
            value={
              state.closePairs.length === 0
                ? "-"
                : state.closePairs.map((p, i) => (
                    <div key={i} className="text-xs font-mono text-cyan-400">
                      {p}
                    </div>
                  ))
            }
          />
        </div>
      }
      bottom={null}
    />
  ),
});
