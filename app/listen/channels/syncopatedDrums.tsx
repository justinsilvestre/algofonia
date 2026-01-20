import * as Tone from "tone";
import { createChannel } from "../tone";

export const syncopatedDrums = createChannel({
  key: "Syncopated drums",
  initialize: () => {
    const clapSynth1 = getClapSynth();
    const clapSynth2 = getClapSynth();
    const lowTomSynth = getLowTomSynth();
    const lowTomSynth2 = getLowTomSynth();

    clapSynth1.disable();
    clapSynth2.disable();
    lowTomSynth.disable();
    lowTomSynth2.disable();

    return {
      clapSynth1,
      clapSynth2,
      lowTomSynth,
      lowTomSynth2,
      clapPattern: "SILENT" as "SILENT" | "SINGLE" | "DOUBLE",
      tomPattern: "SILENT" as "SILENT" | "SINGLE" | "DOUBLE",
    };
  },
  teardown: ({ clapSynth1, clapSynth2, lowTomSynth, lowTomSynth2 }) => {
    clapSynth1.dispose();
    clapSynth2.dispose();
    lowTomSynth.dispose();
    lowTomSynth2.dispose();
  },
  onLoop: (tone, channelState, time) => {
    const { clapSynth1, clapSynth2, lowTomSynth, lowTomSynth2 } = channelState;

    // clapSynth1.hit("+0:0:2");

    clapSynth2.hit("+0:1");
    clapSynth1.hit("+0:1:2");

    // clapSynth1.hit("+0:2:2");

    clapSynth2.hit("+0:3");
    clapSynth1.hit("+0:3:2");

    // low tom on 12th and 15th 16th notes
    lowTomSynth.hit("F3", "F2", "+0:2:3");
    lowTomSynth.hit("F3", "F2", "+0:3:4");

    lowTomSynth2.hit("F3", "F2", "+0:1:3");
    lowTomSynth2.hit("F3", "F2", "+0:2:4");

    return channelState;
  },
  respond: (tone, channelState, input) => {
    if (input.frontToBack < 33) {
      channelState.clapPattern = "SILENT";
      channelState.clapSynth1.disable();
      channelState.clapSynth2.disable();
    } else if (input.frontToBack < 66) {
      channelState.clapPattern = "SINGLE";
      channelState.clapSynth1.enable();
      channelState.clapSynth2.disable();
    } else {
      channelState.clapPattern = "DOUBLE";
      channelState.clapSynth1.enable();
      channelState.clapSynth2.enable();
    }

    // // Link lowTomSynth volume to around input (0-100)
    // // -20dB to +3dB range
    // const lowTomVolume = -20 + (input.around / 100) * 23;
    // channelState.lowTomSynth.setVolume(lowTomVolume);

    if (input.around < 33) {
      channelState.tomPattern = "SILENT";
      channelState.lowTomSynth.disable();
      channelState.lowTomSynth2.disable();
    } else if (input.around < 66) {
      channelState.tomPattern = "SINGLE";
      channelState.lowTomSynth2.enable();
      channelState.lowTomSynth.disable();
    } else {
      channelState.tomPattern = "DOUBLE";
      channelState.lowTomSynth.enable();
      channelState.lowTomSynth2.enable();
    }

    return channelState;
  },
  renderMonitorDisplay: (channelState, tone, { frontToBack, around }) => {
    return (
      <div className="text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600 flex-1">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Clap Pattern</span>
              <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
                {channelState.clapPattern}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Tom Pattern</span>
              <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
                {channelState.tomPattern}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});

function getClapSynth() {
  const volume = -15;
  const clapFilter = new Tone.Filter({
    type: "highpass",
    frequency: 1200,
    Q: 0.7,
  }).toDestination();

  const burstSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.0005,
      decay: 0.015,
      sustain: 0,
    },
  }).connect(clapFilter);
  burstSynth.volume.value = volume;

  const tailSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.002,
      decay: 0.25,
      sustain: 0,
    },
  }).connect(clapFilter);
  tailSynth.volume.value = volume;

  return {
    burstSynth,
    tailSynth,
    dispose: () => {
      burstSynth.dispose();
      tailSynth.dispose();
    },
    hit: (time: Tone.Unit.Time = Tone.now()) => {
      // rapid burst cluster (the “hands”)
      const timeSeconds = Tone.Time(time).toSeconds();
      burstSynth.triggerAttackRelease("64n", timeSeconds);
      burstSynth.triggerAttackRelease("64n", timeSeconds + 0.012);
      burstSynth.triggerAttackRelease("64n", timeSeconds + 0.024);

      // diffuse noise tail
      tailSynth.triggerAttackRelease("8n", timeSeconds + 0.03);
    },
    disable: () => {
      burstSynth.volume.value = -100;
      tailSynth.volume.value = -100;
    },
    enable: () => {
      burstSynth.volume.value = volume;
      tailSynth.volume.value = volume;
    },
  };
}

function getLowTomSynth() {
  // Create a more tom-like sound with proper frequency range
  const fundamentalSynth = new Tone.Synth({
    oscillator: { type: "triangle" }, // More harmonically rich than sine
    envelope: {
      attack: 0.001, // Much faster attack for punch
      decay: 0.6,
      sustain: 0,
      release: 0.05,
    },
  });

  // Add a sub component for body
  const subSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.0005, // Even faster attack for sub punch
      decay: 0.4,
      sustain: 0,
      release: 0.02,
    },
  });

  // Tom-appropriate filtering - higher cutoff for clarity
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: 800, // Higher cutoff for tom clarity
    Q: 1.5, // Less resonance
  });

  // Light saturation for warmth without muddiness
  const distortion = new Tone.Distortion({
    distortion: 0.1, // Much lighter distortion
    oversample: "2x",
  });

  // Chain: fundamental -> filter -> distortion -> destination
  // Sub goes through same chain for consistency
  fundamentalSynth.chain(filter, distortion, Tone.getDestination());
  subSynth.connect(filter);

  const baseVolume = 3;
  fundamentalSynth.volume.value = baseVolume;
  subSynth.volume.value = baseVolume - 6; // Sub is quieter

  return {
    synth: fundamentalSynth, // Keep for compatibility
    subSynth,
    dispose: () => {
      fundamentalSynth.dispose();
      subSynth.dispose();
      filter.dispose();
      distortion.dispose();
    },
    hit: (
      highTone: Tone.Unit.Frequency,
      lowTone: Tone.Unit.Frequency,
      time: Tone.Unit.Time = Tone.now()
    ) => {
      const timeSeconds = Tone.Time(time).toSeconds();

      // Trigger both synths at tom-appropriate pitch
      fundamentalSynth.triggerAttack(highTone, time); // Higher fundamental for tom
      subSynth.triggerAttack(lowTone, time); // Sub an octave lower

      // Tom-like pitch bend - more subtle than kick
      fundamentalSynth.frequency.setValueAtTime(175, time); // Start at F3
      fundamentalSynth.frequency.exponentialRampToValueAtTime(
        120,
        timeSeconds + 0.12
      ); // Moderate dip, tom-like duration

      // Sub has a very subtle dip
      subSynth.frequency.setValueAtTime(87, time);
      subSynth.frequency.exponentialRampToValueAtTime(80, timeSeconds + 0.08);

      // Release both with tom-like timing
      fundamentalSynth.triggerRelease(timeSeconds + 0.6);
      subSynth.triggerRelease(timeSeconds + 0.4);
    },
    setVolume: (volume: number) => {
      fundamentalSynth.volume.value = volume;
      subSynth.volume.value = volume - 6; // Keep sub quieter
    },
    disable: () => {
      fundamentalSynth.volume.value = -100;
      subSynth.volume.value = -100;
    },
    enable: () => {
      fundamentalSynth.volume.value = baseVolume;
      subSynth.volume.value = baseVolume - 6; // Keep sub quieter
    },
  };
}
