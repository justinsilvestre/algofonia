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
  teardown: ({ voiceSynth }) => {
    voiceSynth.dispose();
  },
  onLoop: (tone, channelState, time) => {
    const { voiceSynth } = channelState;

    // Only start if not already playing to avoid crackling from frequent restarts
    if (voiceSynth.player.state !== "started" && voiceSynth.player.loaded) {
      voiceSynth.player.start(time);
    }
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
  },
  renderMonitorDisplay: (channelState, tone, { frontToBack, around }) => {
    // Get values directly from the synth state
    const f1 = Math.round(channelState.voiceSynth.formantTargetValues.f1);
    const f2 = Math.round(channelState.voiceSynth.formantTargetValues.f2);
    const volume = Math.round(channelState.voiceSynth.volumeTargetValue);

    return (
      <div className="flex-1 text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Volume</span>
            <span className="font-mono text-base text-red-400">{volume}dB</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">F1</span>
            <span className="font-mono text-base text-green-400">{f1}Hz</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-400">F2</span>
            <span className="font-mono text-base text-blue-400">{f2}Hz</span>
          </div>
        </div>
      </div>
    );
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

  let volumeTargetValue = -3;
  const player = new Tone.Player({
    url: "/samples/Perry Como - Please Believe Me.mp3",
    loop: true,
    autostart: false,
    playbackRate: 1,
    volume: volumeTargetValue,
  }).connect(chorus);

  // const formantTargetVals = { f1: 800, f2: 1200 };
  let f1TargetVal = 800;
  let f2TargetVal = 1200;
  const synthInterface = {
    player,
    formant1,
    formant2,
    formantTargetValues: {
      get f1() {
        return f1TargetVal;
      },
      get f2() {
        return f2TargetVal;
      },
    },
    get volumeTargetValue() {
      return volumeTargetValue;
    },
    dispose: () => {
      player.dispose();
      formant1.dispose();
      formant2.dispose();
      formantSum.dispose();
      chorus.dispose(); // Runtime InvalidAccessError
    },
    setFormants: (f1Hz: number, f2Hz: number) => {
      // Use smooth parameter changes to prevent clicking
      formant1.frequency.rampTo(f1Hz, 0.1);
      formant2.frequency.rampTo(f2Hz, 0.1);
      f1TargetVal = f1Hz;
      f2TargetVal = f2Hz;
    },
    setVolume: (volume: number) => {
      player.volume.rampTo(volume, 0.1);
      volumeTargetValue = volume;
    },
  };
  return synthInterface;
}
