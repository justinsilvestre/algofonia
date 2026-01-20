import * as Tone from "tone";
import { createChannel } from "../tone";

// pattern chosen via `frontToBack` input:
// level 1 - no hi hat
// level 2 - open hi hat on every off-beat
// level 3 - add open hi hat on on-beats
// level 4 - constant open hi hat, trap-like

// pattern chosen via `around` input:
// level 1 - silent
// level 2 - add closed hi hat around the open hi hats

export const hiHat = createChannel({
  key: "Hi hat",
  initialize: (tone) => {
    const state = {
      hiHat: getHiHatSynth(),
      closedHiHat: getClosedHiHatSynth(),
      closedHiHat2: getClosedHiHatSynth(),
      pattern: "SILENT" as "SILENT" | "OFF-BEATS" | "FILLED" | "CONSTANT",
      openHiHatVolume: -15,
    };
    state.hiHat.disable();
    state.closedHiHat.disable();
    state.closedHiHat2.disable();

    return state;
  },
  teardown: (channelState) => {
    channelState.hiHat.synth.dispose();
    channelState.hiHat.reverb.dispose();
    channelState.hiHat.panner.dispose();
    channelState.closedHiHat.synth.dispose();
    channelState.closedHiHat2.synth.dispose();
  },
  onLoop: (tone, channelState, time) => {
    const { hiHat, closedHiHat, closedHiHat2 } = channelState;

    closedHiHat.hit("+0:0:1");
    hiHat.hit("+0:0:2");
    closedHiHat.hit("+0:0:3");

    closedHiHat.hit("+0:1:1");
    hiHat.hit("+0:1:2");
    closedHiHat.hit("+0:1:3");

    closedHiHat.hit("+0:2:1");
    hiHat.hit("+0:2:2");
    closedHiHat.hit("+0:2:3");

    closedHiHat.hit("+0:3:1");
    hiHat.hit("+0:3:2");
    closedHiHat.hit("+0:3:3");

    // on all 16th notes not already hit,
    // add closedHiHat2 for "CONSTANT" pattern
    closedHiHat2.hit("+0:0:0");
    closedHiHat2.hit("+0:1:0");
    closedHiHat2.hit("+0:2:0");
    closedHiHat2.hit("+0:3:0");

    return channelState;
  },
  respond: (tone, channelState, { frontToBack, around }) => {
    // Adjust open hi-hat reverb and panning based on around input (0-100)
    // Higher around = more reverb + panning movement
    const effectAmount = around / 100; // Convert to 0-1
    channelState.hiHat.setEffects(effectAmount);
    // also increase volume when more reverb for balance
    const volumeAdjustment = (around / 100) * 15; // 0 to +15 dB

    if (frontToBack < 25) {
      channelState.pattern = "SILENT";
      channelState.hiHat.disable();
      channelState.closedHiHat.disable();
      channelState.closedHiHat2.disable();
    } else if (frontToBack < 50) {
      channelState.pattern = "OFF-BEATS";
      channelState.hiHat.enable();
      channelState.hiHat.synth.volume.value += volumeAdjustment;
      channelState.openHiHatVolume = channelState.hiHat.synth.volume.value;
      channelState.closedHiHat.disable();
      channelState.closedHiHat2.disable();
    } else if (frontToBack < 93) {
      channelState.pattern = "FILLED";
      channelState.hiHat.enable();
      channelState.hiHat.synth.volume.value += volumeAdjustment;
      channelState.openHiHatVolume = channelState.hiHat.synth.volume.value;
      channelState.closedHiHat.enable();
      channelState.closedHiHat2.disable();
    } else {
      channelState.pattern = "CONSTANT";
      channelState.hiHat.enable();
      channelState.hiHat.synth.volume.value += volumeAdjustment;
      channelState.openHiHatVolume = channelState.hiHat.synth.volume.value;
      channelState.closedHiHat.enable();
      channelState.closedHiHat2.enable();
    }

    return channelState;
  },
  renderMonitorDisplay: (channelState, tone, { frontToBack, around }) => {
    const pattern = channelState.pattern;
    const openHiHatReverb =
      channelState.hiHat?.reverb?.wet?.value?.toFixed(2) ?? "-";
    const openHiHatVolume = channelState.openHiHatVolume.toFixed(2);

    return (
      <div className="text-xs bg-gray-950 rounded-lg p-3 shadow-sm border border-gray-600">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col items-start">
            <span className="text-gray-400">Pattern</span>
            <span className="font-mono text-base text-gray-100 uppercase tracking-wide">
              {pattern}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Open HH Reverb</span>
              <span className="font-mono text-green-400 text-base">
                {openHiHatReverb}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-gray-400">Open HH Vol</span>
              <span className="font-mono text-blue-400 text-base">
                {openHiHatVolume}dB
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});

function getHiHatSynth() {
  const volume = -15;
  const synth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.4, // open
      sustain: 0,
    },
  });

  const filter = new Tone.Filter(7000, "highpass");
  const reverb = new Tone.Reverb({
    decay: 2.0,
    wet: 0, // Start with no reverb
  });
  const panner = new Tone.Panner(0); // Start centered

  // Chain: synth -> filter -> reverb -> panner -> destination
  synth.chain(filter, reverb, panner, Tone.getDestination());
  synth.volume.value = volume;

  return {
    synth,
    reverb,
    panner,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    setEffects: (amount: number) => {
      // Control reverb wet amount
      reverb.wet.value = amount * 0.6; // 0 to 0.6 wet amount

      // Control panning: -1 (left) to +1 (right) based on around value
      const panPosition = (amount - 0.5) * 2; // Convert 0-1 to -1 to +1
      panner.pan.value = panPosition;
    },
    disable: () => {
      synth.volume.value = -100;
    },
    enable: () => {
      synth.volume.value = volume;
    },
  };
}

function getClosedHiHatSynth() {
  const volume = -15;
  const synth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.1, // closed
      sustain: 0,
    },
  })
    .toDestination()
    .connect(new Tone.Filter(7000, "highpass"));
  synth.volume.value = volume;

  return {
    synth,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    disable: () => {
      synth.volume.value = -100;
    },
    enable: () => {
      synth.volume.value = volume;
    },
  };
}
