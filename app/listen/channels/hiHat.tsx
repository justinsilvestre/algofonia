import * as Tone from "tone";
import { createChannel } from "../tone";

type HiHatEvent = {
  time: Tone.Unit.Time;
  hihatType: "O" | "C";
};

type PatternName = keyof typeof patterns;
const patterns = {
  SILENT: [],
  "OFF-BEATS": pattern(
    ["0:0:2", "O"],
    ["0:1:2", "O"],
    ["0:2:2", "O"],
    ["0:3:2", "O"]
  ),
  FILLED: pattern(
    // Open hi-hats on off-beats
    // Closed hi-hats on other 16th notes
    ["0:0:1", "C"],
    ["0:0:2", "O"],
    ["0:0:3", "C"],
    ["0:1:1", "C"],
    ["0:1:2", "O"],
    ["0:1:3", "C"],
    ["0:2:1", "C"],
    ["0:2:2", "O"],
    ["0:2:3", "C"],
    ["0:3:1", "C"],
    ["0:3:2", "O"],
    ["0:3:3", "C"]
  ),
  CONSTANT: pattern(
    // Open hi-hats on off-beats
    // Closed hi-hats on all other 16th notes
    ["0:0:0", "C"],
    ["0:0:1", "C"],
    ["0:0:2", "O"],
    ["0:0:3", "C"],
    ["0:1:0", "C"],
    ["0:1:1", "C"],
    ["0:1:2", "O"],
    ["0:1:3", "C"],
    ["0:2:0", "C"],
    ["0:2:1", "C"],
    ["0:2:2", "O"],
    ["0:2:3", "C"],
    ["0:3:0", "C"],
    ["0:3:1", "C"],
    ["0:3:2", "O"],
    ["0:3:3", "C"]
  ),
} as const satisfies Record<string, HiHatEvent[]>;

function getPartForPattern(
  patternName: PatternName,
  hiHat: ReturnType<typeof getHiHatSynth>,
  closedHiHat: ReturnType<typeof getClosedHiHatSynth>
) {
  const pattern = patterns[patternName];
  if (!pattern.length) return null;

  const part = new Tone.Part<HiHatEvent>((time, event) => {
    if (event.hihatType === "O") {
      hiHat.hit(time);
    } else if (event.hihatType === "C") {
      closedHiHat.hit(time);
    }
  }, pattern);
  part.loop = true;
  part.loopEnd = "1m";

  return part;
}

export const hiHat = createChannel({
  key: "Hi hat",
  initialize: ({ currentMeasureStartTime }) => {
    const hiHat = getHiHatSynth();
    const closedHiHat = getClosedHiHatSynth();

    const startPattern = "SILENT" as PatternName;
    const part = getPartForPattern(startPattern, hiHat, closedHiHat);
    part?.start(currentMeasureStartTime);

    return {
      hiHat,
      closedHiHat,
      part,
      pattern: startPattern,
      openHiHatVolume: hiHat.synth.volume.value,
      openHiHateReverb: hiHat.reverb.wet.value,
    };
  },
  teardown: ({ hiHat, closedHiHat, part }) => {
    hiHat.synth.dispose();
    hiHat.reverb.dispose();
    closedHiHat.synth.dispose();
    part?.dispose();
  },
  respond: (
    { currentMeasureStartTime },
    { getState, setState },
    { frontToBack, around }
  ) => {
    const { part, pattern, hiHat, closedHiHat } = getState();

    // Adjust open hi-hat reverb based on around input (0-100)
    // Higher around = more reverb movement
    const effectAmount = around / 100; // Convert to 0-1
    hiHat.setEffects(effectAmount);
    // also increase volume when more reverb for balance
    const volumeAdjustment = (around / 100) * 15; // 0 to +15 dB

    const updatePart = (newPattern: PatternName) => {
      if (newPattern === pattern) return;

      if (part) part.dispose();

      // adjust volume
      hiHat.synth.volume.value = -15 + volumeAdjustment;

      const newPart = getPartForPattern(newPattern, hiHat, closedHiHat);
      setState((state) => ({
        ...state,
        openHiHatVolume: hiHat.synth.volume.value,
        openHiHateReverb: hiHat.reverb.wet.value,
        pattern: newPattern,
        part: newPart,
      }));
      newPart?.start(currentMeasureStartTime);
    };

    if (frontToBack < 25) {
      updatePart("SILENT");
    } else if (frontToBack < 50) {
      updatePart("OFF-BEATS");
    } else if (frontToBack < 93) {
      updatePart("FILLED");
    } else {
      updatePart("CONSTANT");
    }
  },
  renderMonitorDisplay: (channelState) => {
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

  // Chain: synth -> filter -> reverb -> ~~panner~~ -> destination
  synth.chain(filter, reverb, Tone.getDestination());
  synth.volume.value = volume;

  return {
    synth,
    reverb,
    hit: (time: Tone.Unit.Time) => {
      synth.triggerAttackRelease("8n", time);
    },
    setEffects: (amount: number) => {
      // Control reverb wet amount
      reverb.wet.value = amount * 0.6; // 0 to 0.6 wet amount
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
  };
}

function pattern(...events: [time: Tone.Unit.Time, hihatType: "O" | "C"][]) {
  return events.map(([time, hihatType]) => ({
    time,
    hihatType,
  }));
}
