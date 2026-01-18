import * as Tone from "tone";
import { createChannel } from "../tone";

export const voice = createChannel({
  key: "Voice",

  initialize: () => {
    const voiceSynth = getVoiceSynth();
    voiceSynth.setFormants(300, 800);
    voiceSynth.setVolume(-12);

    return { voiceSynth };
  },
  onLoop: (tone, channelState, time) => {
    const { voiceSynth } = channelState;

    // Only start if not already playing to avoid crackling from frequent restarts
    if (voiceSynth.player.state !== "started" && voiceSynth.player.loaded) {
      voiceSynth.player.start(time);
    }

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    // Map around to F2 frequency
    const f2 = 800 + (around / 100) * 1400; // 800Hz to 2200Hz

    // For frontToBack: 0-50 controls volume, 40-100 controls F1 formant
    let volume: number;
    let f1: number;

    if (frontToBack <= 50) {
      // Volume ramps from silence (-60dB) to normal (-3dB) over 0-50 range
      volume = -60 + (frontToBack / 50) * 57;
    } else {
      // Above 50, keep at normal volume
      volume = -3;
    }

    if (frontToBack >= 40) {
      // F1 formant changes from 40-100 range (300Hz to 1000Hz)
      const formantProgress = Math.max(0, (frontToBack - 40) / 60);
      f1 = 300 + formantProgress * 700;
    } else {
      // Below 40, keep F1 at base frequency
      f1 = 300;
    }

    channelState.voiceSynth.setFormants(f1, f2);
    channelState.voiceSynth.setVolume(volume);

    return channelState;
  },
});

function getVoiceSynth() {
  const chorus = new Tone.Chorus({
    frequency: 0.3,
    delayTime: 8,
    depth: 0.6,
    spread: 180,
  }).start();

  // Reduced Q values to prevent resonant artifacts and crackling
  const formant1 = new Tone.Filter({ type: "bandpass", frequency: 800, Q: 3 });
  const formant2 = new Tone.Filter({
    type: "bandpass",
    frequency: 1200,
    Q: 2.5,
  });

  const formantSum = new Tone.Gain(0.8); // Increased from 0.5 for audibility

  chorus.fan(formant1, formant2);
  formant1.connect(formantSum);
  formant2.connect(formantSum);
  formantSum.toDestination();

  const player = new Tone.Player({
    url: "/samples/Perry Como - Please Believe Me.mp3",
    loop: true,
    autostart: false,
    playbackRate: 1,
    volume: -3, // Increased from -12dB for audibility
  }).connect(chorus);

  return {
    player,
    formant1,
    formant2,
    setFormants: (f1: number, f2: number) => {
      // Use smooth parameter changes to prevent clicking
      formant1.frequency.rampTo(f1, 0.1);
      formant2.frequency.rampTo(f2, 0.1);
    },
    setVolume: (volume: number) => {
      player.volume.rampTo(volume, 0.1);
    },
  };
}
