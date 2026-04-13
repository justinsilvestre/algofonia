import * as Tone from "tone";
import { defineSoundModule } from "../tone";
import { getBassSynth } from "../instruments/getBassSynth";
import {
  SoundModuleDisplay,
  SoundModuleDisplayItem,
} from "../SoundModuleDisplay";
import { Slider } from "../SoundModuleDisplaySlider";

export const bassSynth = defineSoundModule({
  initialize: ({ currentMeasureStartTime, tonic }) => {
    console.log("soundModules!", "bassSynth initialized!!");
    const synth = getBassSynth();

    // Play the tonic note continuously
    const tonicNote = `${tonic}1` as Tone.Unit.Frequency; // Low octave for bass
    synth.bassSynth.triggerAttack(tonicNote, currentMeasureStartTime);

    return {
      state: {
        // Filter controls
        lowPassFreq: 800,
        lowPassQ: 1.5,
        highPassFreq: 40,
        highPassQ: 0.7,

        // Saturation and dynamics
        saturation: 0.05,
        compressorThreshold: -12,
        compressorRatio: 4,

        // Synth parameters
        filterFreq: 300,
        filterQ: 2,
        decay: 0.3,
        sustain: 0.7,

        // Overall volume
        volume: -8,
        playing: true,
      },
      controls: {
        synth,
        activeNote: tonicNote,
        isCurrentlyPlaying: true,
      },
    };
  },

  teardown: ({ synth }) => {
    synth.bassSynth.triggerRelease();
    synth.dispose();
  },

  onToneEvent: {
    tonicChange: (controls, state, tone, newTonic) => {
      // Stop current note and start new tonic
      if (controls.isCurrentlyPlaying) {
        controls.synth.bassSynth.triggerRelease();

        if (state.playing) {
          const newTonicNote = `${newTonic}1` as Tone.Unit.Frequency;
          controls.synth.bassSynth.triggerAttack(newTonicNote);
          controls.activeNote = newTonicNote;
          // Keep isCurrentlyPlaying as true
        } else {
          controls.isCurrentlyPlaying = false;
        }
      }
    },
  },

  onStateChange: ({ currentMeasureStartTime, tonic }, controls, state) => {
    const { synth } = controls;

    // Update filters
    synth.lowPassFilter.frequency.value = state.lowPassFreq;
    synth.lowPassFilter.Q.value = state.lowPassQ;
    synth.highPassFilter.frequency.value = state.highPassFreq;
    synth.highPassFilter.Q.value = state.highPassQ;

    // Update saturation and compression
    synth.saturator.distortion = state.saturation;
    synth.compressor.threshold.value = state.compressorThreshold;
    synth.compressor.ratio.value = state.compressorRatio;

    // Update synth filter and envelope
    synth.bassSynth.filter.frequency.value = state.filterFreq;
    synth.bassSynth.filter.Q.value = state.filterQ;
    synth.bassSynth.envelope.decay = state.decay;
    synth.bassSynth.envelope.sustain = state.sustain;

    // Update volume
    synth.bassSynth.volume.value = state.volume;

    // Handle play/stop
    if (state.playing && !controls.isCurrentlyPlaying) {
      // Start playing
      const tonicNote = `${tonic}1` as Tone.Unit.Frequency;
      synth.bassSynth.triggerAttack(tonicNote);
      controls.activeNote = tonicNote;
      controls.isCurrentlyPlaying = true;
    } else if (!state.playing && controls.isCurrentlyPlaying) {
      // Stop playing
      synth.bassSynth.triggerRelease();
      controls.isCurrentlyPlaying = false;
    }
  },

  renderMonitorDisplay: (state, setState) => {
    return (
      <SoundModuleDisplay
        title="Bass Synth"
        className="w-100"
        boxContents={
          <div className="flex flex-row flex-wrap justify-between">
            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-blue-600"
              label="Status"
              value={state.playing ? "Playing" : "Stopped"}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-green-600"
              label="Low Pass"
              value={`${state.lowPassFreq.toFixed(0)}Hz Q:${state.lowPassQ.toFixed(1)}`}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-orange-600"
              label="High Pass"
              value={`${state.highPassFreq.toFixed(0)}Hz Q:${state.highPassQ.toFixed(1)}`}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-purple-600"
              label="Saturation"
              value={`${(state.saturation * 100).toFixed(0)}%`}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-cyan-600"
              label="Filter"
              value={`${state.filterFreq.toFixed(0)}Hz Q:${state.filterQ.toFixed(1)}`}
            />

            <SoundModuleDisplayItem
              className="flex-1 [&>.value]:text-pink-600"
              label="Envelope"
              value={`D:${state.decay.toFixed(2)} S:${state.sustain.toFixed(2)}`}
            />
          </div>
        }
        bottom={
          <>
            {/* Play/Stop Toggle */}
            <div className="flex mb-2">
              <button
                onClick={() => setState({ ...state, playing: !state.playing })}
                className={`px-4 py-2 rounded ${
                  state.playing
                    ? "bg-green-600 text-white"
                    : "bg-gray-600 text-gray-300"
                }`}
              >
                {state.playing ? "Stop" : "Play"}
              </button>
            </div>

            {/* Low Pass Filter Controls */}
            <div className="flex">
              <Slider
                min={200}
                max={2000}
                step={10}
                value={state.lowPassFreq}
                onChange={(v) => setState({ ...state, lowPassFreq: v })}
                className="flex-1 slider-green-600"
              />
              <Slider
                min={0.1}
                max={10}
                step={0.1}
                value={state.lowPassQ}
                onChange={(v) => setState({ ...state, lowPassQ: v })}
                className="flex-1 slider-green-600"
              />
            </div>

            {/* High Pass Filter Controls */}
            <div className="flex">
              <Slider
                min={20}
                max={200}
                step={5}
                value={state.highPassFreq}
                onChange={(v) => setState({ ...state, highPassFreq: v })}
                className="flex-1 slider-orange-600"
              />
              <Slider
                min={0.1}
                max={5}
                step={0.1}
                value={state.highPassQ}
                onChange={(v) => setState({ ...state, highPassQ: v })}
                className="flex-1 slider-orange-600"
              />
            </div>

            {/* Saturation and Compression */}
            <div className="flex">
              <Slider
                min={0}
                max={0.3}
                step={0.01}
                value={state.saturation}
                onChange={(v) => setState({ ...state, saturation: v })}
                className="flex-1 slider-purple-600"
              />
              <Slider
                min={-24}
                max={-6}
                step={1}
                value={state.compressorThreshold}
                onChange={(v) => setState({ ...state, compressorThreshold: v })}
                className="flex-1 slider-purple-600"
              />
            </div>

            {/* Synth Filter */}
            <div className="flex">
              <Slider
                min={50}
                max={800}
                step={10}
                value={state.filterFreq}
                onChange={(v) => setState({ ...state, filterFreq: v })}
                className="flex-1 slider-cyan-600"
              />
              <Slider
                min={0.1}
                max={10}
                step={0.1}
                value={state.filterQ}
                onChange={(v) => setState({ ...state, filterQ: v })}
                className="flex-1 slider-cyan-600"
              />
            </div>

            {/* Envelope Controls */}
            <div className="flex">
              <Slider
                min={0.1}
                max={2.0}
                step={0.1}
                value={state.decay}
                onChange={(v) => setState({ ...state, decay: v })}
                className="flex-1 slider-pink-600"
              />
              <Slider
                min={0.0}
                max={1.0}
                step={0.05}
                value={state.sustain}
                onChange={(v) => setState({ ...state, sustain: v })}
                className="flex-1 slider-pink-600"
              />
            </div>

            {/* Volume */}
            <Slider
              min={-20}
              max={0}
              step={1}
              value={state.volume}
              onChange={(v) => setState({ ...state, volume: v })}
              className="w-full slider-blue-600"
            />
          </>
        }
      />
    );
  },
});
