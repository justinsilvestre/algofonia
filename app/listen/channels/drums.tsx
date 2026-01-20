import * as Tone from "tone";
import { createChannel } from "../tone";
import { channel } from "diagnostics_channel";

// frontToBack moves between:
// level 1: silence
// level 2: two-step kick pattern
// level 3: add snare on 2 and 4
// level 4: four-on-the-floor kick pattern with snare on 2 and 4

export const drums = createChannel({
  key: "Drums",
  initialize: () => {
    const startKick = get909KickSynth();
    const fourOnFloorKick = get909KickSynth();
    const twoStepOffbeatKick = get909KickSynth();
    const syncopatedKick = get909KickSynth();
    const snare = getSnareSynth();

    startKick.disable();
    fourOnFloorKick.disable();
    twoStepOffbeatKick.disable();
    syncopatedKick.disable();
    snare.disable();

    return {
      pattern: "SILENT" as
        | "SILENT"
        | "TWO_STEP_KICK"
        | "TWO_STEP_KICK_AND_SNARE"
        | "FOUR_ON_FLOOR"
        | "ADDED_SYNCOPATION",
      startKick,
      fourOnFloorKick,
      twoStepOffbeatKick,
      syncopatedKick,
      snare,
    };
  },
  teardown: ({
    startKick,
    fourOnFloorKick,
    twoStepOffbeatKick,
    syncopatedKick,
    snare,
  }) => {
    startKick.dispose();
    fourOnFloorKick.dispose();
    twoStepOffbeatKick.dispose();
    syncopatedKick.dispose();
    snare.dispose();
  },
  onLoop: (tone, channelState, time) => {
    console.log("Drums onLoop at time", time);
    const {
      startKick,
      fourOnFloorKick,
      twoStepOffbeatKick,
      syncopatedKick,
      snare,
    } = channelState;

    startKick.hit(time);
    startKick.triggerRelease(time);
    syncopatedKick.hit("+0:0:4");

    fourOnFloorKick.hit("+0:1");
    fourOnFloorKick.triggerRelease("+0:1");
    snare.hit("+0:1");

    fourOnFloorKick.hit("+0:2");
    fourOnFloorKick.triggerRelease("+0:2");
    twoStepOffbeatKick.hit("+0:2:2");
    twoStepOffbeatKick.triggerRelease("+0:2:2");

    fourOnFloorKick.hit("+0:3");
    fourOnFloorKick.triggerRelease("+0:3");
    snare.hit("+0:3");

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    const {
      startKick,
      fourOnFloorKick,
      twoStepOffbeatKick,
      syncopatedKick,
      snare,
    } = channelState;
    // Control kick distortion based on around input (0-100)
    const distortionAmount = 1 - around / 100; // Convert to 0-1
    // const distortionAmount = 0;
    startKick.setDistortion(distortionAmount);
    fourOnFloorKick.setDistortion(distortionAmount);
    twoStepOffbeatKick.setDistortion(distortionAmount);

    // Control kick duration based on around - lower values = longer duration
    const durationMultiplier = 1 + (around / 100) * 1; // 1x to 2x duration
    const baseDuration = 0.35;
    const newDuration = baseDuration * durationMultiplier;
    startKick.setDuration(newDuration);
    fourOnFloorKick.setDuration(newDuration);
    twoStepOffbeatKick.setDuration(newDuration);

    if (frontToBack < 25) {
      channelState.pattern = "SILENT";
      startKick.disable();
      fourOnFloorKick.disable();
      twoStepOffbeatKick.disable();
      syncopatedKick.disable();
      snare.disable();
    } else if (frontToBack < 30) {
      channelState.pattern = "TWO_STEP_KICK";
      startKick.enable();
      fourOnFloorKick.disable();
      twoStepOffbeatKick.enable();
      syncopatedKick.disable();
      snare.disable();
    } else if (frontToBack < 60) {
      channelState.pattern = "TWO_STEP_KICK_AND_SNARE";
      startKick.enable();
      fourOnFloorKick.disable();
      twoStepOffbeatKick.enable();
      syncopatedKick.disable();
      snare.enable();
    } else if (frontToBack < 90) {
      channelState.pattern = "FOUR_ON_FLOOR";
      startKick.enable();
      fourOnFloorKick.enable();
      twoStepOffbeatKick.disable();
      syncopatedKick.disable();
      snare.enable();
    } else {
      channelState.pattern = "ADDED_SYNCOPATION";
      startKick.enable();
      fourOnFloorKick.enable();
      twoStepOffbeatKick.enable();
      syncopatedKick.enable();
      snare.enable();
    }

    console.log("Responded!", channelState.pattern, { frontToBack, around });

    return { ...channelState };
  },
  renderMonitorDisplay: (channelState, tone, { frontToBack, around }) => {
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
          sustain: Math.max(0.1, sustainLevel),
          release: Math.max(0.05, releaseTime),
        },
      });
    },
    triggerRelease: function (time: Tone.Unit.Time) {
      const seconds = Tone.Time(time).toSeconds();
      bodySynth.triggerRelease(seconds + this.kickDuration);
    },
    disable: () => {
      clickSynth.volume.value = -100;
      bodySynth.volume.value = -100;

      bodySynth.triggerRelease();
    },
    enable: () => {
      clickSynth.volume.value = 0;
      bodySynth.volume.value = 0;
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
    disable: () => {
      synth.triggerRelease();

      synth.volume.value = -100;
    },
    enable: () => {
      synth.volume.value = 0;
    },
    dispose: () => {
      synth.dispose();
    },
  };
}
