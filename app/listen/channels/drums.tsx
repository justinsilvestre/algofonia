import * as Tone from "tone";
import { createChannel } from "../tone";

type DrumEvent = "K" | "S" | "KS" | null | DrumEvent[];
type PatternName = keyof typeof patterns;

const patterns = {
  SILENT: [],
  TWO_STEP_KICK: ["K", null, [null, "K"], null],
  TWO_STEP_KICK_AND_SNARE: ["K", "S", [null, "K"], "S"],
  FOUR_ON_FLOOR: ["K", "KS", "K", "KS"],
  ADDED_SYNCOPATION: [["K", null, null, "K"], "KS", ["K", "K"], "KS"],
} as const satisfies Record<string, DrumEvent[]>;

export const drums = createChannel({
  key: "Drums",
  initialize: ({ currentMeasureStartTime }) => {
    const kick = get909KickSynth();
    const snare = getSnareSynth();

    const startPattern = "SILENT" as PatternName;
    const sequence = getSequenceForPattern(startPattern, kick, snare);

    if (sequence) sequence.start(currentMeasureStartTime);

    return {
      pattern: startPattern,
      sequence,
      distortionAmount: 0,
      kickDuration: 0.35,
      kick,
      snare,
    };
  },
  teardown: ({ snare, sequence }) => {
    snare.dispose();
    sequence?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { sequence, pattern, kick, snare } = getState();

    // Control kick distortion based on around input (0-100)
    const distortionAmount = 1 - around / 100; // Convert to 0-1

    kick.setDistortion(distortionAmount);
    // Control kick duration based on around - lower values = longer duration
    const durationMultiplier = 1 + (around / 100) * 1; // 1x to 2x duration
    const baseDuration = 0.35;
    const newDuration = baseDuration * durationMultiplier;
    kick.setDuration(newDuration);

    setState((state) => ({
      ...state,
      distortionAmount,
      kickDuration: newDuration,
    }));

    const updateSequence = (newPattern: PatternName) => {
      if (newPattern === pattern) return;

      if (sequence) sequence.dispose();

      const newSequence = getSequenceForPattern(newPattern, kick, snare);
      setState((state) => ({
        ...state,
        pattern: newPattern,
        sequence: newSequence,
      }));
      newSequence?.start(currentMeasureStartTime);
    };

    if (frontToBack < 25) updateSequence("SILENT");
    else if (frontToBack < 50) updateSequence("TWO_STEP_KICK");
    else if (frontToBack < 75) updateSequence("TWO_STEP_KICK_AND_SNARE");
    else if (frontToBack < 90) updateSequence("FOUR_ON_FLOOR");
    else updateSequence("ADDED_SYNCOPATION");

    return;
  },
  renderMonitorDisplay: (channelState, tone, { around }) => {
    // Calculate the same values as in respond function
    const distortionAmount = (1 - around / 100).toFixed(2);
    const durationMultiplier = 1 + (around / 100) * 1;
    const baseDuration = 0.35;
    const kickDuration = (baseDuration * durationMultiplier).toFixed(2);

    return (
      <div className="text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Pattern</span>
            <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
              {channelState.pattern.replace(/_/g, " ")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Kick Distort</span>
              <span className="font-mono text-green-400 text-base">
                {distortionAmount}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Kick Duration</span>
              <span className="font-mono text-blue-400 text-base">
                {kickDuration}s
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});

function get909KickSynth() {
  const clickSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.0005,
      decay: 0.01,
      sustain: 0,
    },
  });

  const bodySynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.35,
      sustain: 0.3, // Non-zero sustain so we can control duration
      release: 0.1,
    },
  });

  const drive = new Tone.Distortion(0.2);

  // More aggressive effects for warping
  const crusher = new Tone.BitCrusher(4); // Lower bits for more obvious effect
  const freqShifter = new Tone.FrequencyShifter(0); // Frequency shifting for warping
  const filter = new Tone.Filter(800, "lowpass"); // Lowpass to darken sound

  // Chain: synths -> distortion -> crusher -> frequency shifter -> filter -> destination
  clickSynth.chain(drive, crusher, freqShifter, filter, Tone.getDestination());
  bodySynth.chain(drive, crusher, freqShifter, filter, Tone.getDestination());

  bodySynth.volume.value = -6;

  return {
    clickSynth,
    bodySynth,
    drive,
    crusher,
    freqShifter,
    filter,
    kickDuration: 0.35, // Default duration
    hit: (time: Tone.Unit.Time) => {
      // transient click
      clickSynth.triggerAttackRelease("64n", time);

      const seconds = Tone.Time(time).toSeconds();

      // tonal body with variable duration
      bodySynth.triggerAttack("C1", time);
      bodySynth.frequency.setValueAtTime(140, time);
      bodySynth.frequency.exponentialRampToValueAtTime(55, seconds + 0.02);
    },
    setDistortion: (amount: number) => {
      // amount 0-1: control multiple warping effects
      drive.distortion = 0.2 + amount * 0.7; // 0.2 to 0.9 (heavier distortion)
      freqShifter.frequency.value = amount * 20; // 0 to 20Hz frequency shift (creates pitch wobble)
      filter.frequency.value = 800 - amount * 600; // 800Hz down to 200Hz (darker/muddier)
    },
    setDuration: function (duration: number) {
      this.kickDuration = duration;
      // Adjust envelope parameters based on duration for more noticeable effect
      const sustainLevel = Math.min(0.6, 0.2 + (duration - 0.35) / 2); // Higher sustain for longer kicks
      const releaseTime = Math.min(0.5, duration * 0.3); // Longer release for longer kicks

      bodySynth.set({
        envelope: {
          attack: 0.001,
          decay: 0.35,
          // sustain: Math.max(0.1, sustainLevel),
          // release: Math.max(0.05, releaseTime),
        },
      });
    },
    triggerRelease: function (time: Tone.Unit.Time) {
      const seconds = Tone.Time(time).toSeconds();
      bodySynth.triggerRelease(seconds + this.kickDuration);
    },

    dispose: () => {
      clickSynth.dispose();
      bodySynth.dispose();
      drive.dispose();
      crusher.dispose();
      freqShifter.dispose();
      filter.dispose();
    },
  };
}

function getSnareSynth() {
  const synth = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: {
      attack: 0.001,
      decay: 0.18,
      sustain: 0.05,
    },
  })
    .connect(new Tone.Filter(2200, "highpass"))
    .toDestination();

  return {
    synth,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    dispose: () => {
      synth.dispose();
    },
  };
}

function getSequenceForPattern(
  patternName: PatternName,
  kick: ReturnType<typeof get909KickSynth>,
  snare: ReturnType<typeof getSnareSynth>
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;
  return new Tone.Sequence<DrumEvent>(
    (time, event) => {
      if (event === "K") {
        kick.hit(time);
        kick.triggerRelease(time);
      } else if (event === "S") {
        snare.hit(time);
      } else if (event === "KS") {
        kick.hit(time);
        kick.triggerRelease(time);
        snare.hit(time);
      }
    },
    pattern,
    "4n"
  );
}
