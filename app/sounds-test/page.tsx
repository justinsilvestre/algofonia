"use client";

import { useState } from "react";
import { useAccelerometer } from "../useAccelerometer";

export default function SoundsTest() {
  const [sliderValues, setSliderValues] = useState({
    slider1: 50,
    slider2: 30,
  });

  const {
    state: accelerometerState,
    requestPermission: requestAccelerometerPermission,
  } = useAccelerometer();
  const sounds = useSounds();
  const requestPermission = () => {
    requestAccelerometerPermission();
    sounds.startAudioContext();
  };

  const handleButtonPress = (buttonNumber: number) => {
    console.log(`Button ${buttonNumber} pressed!`);
    switch (buttonNumber) {
      case 1:
        sounds.playSoundA();
        break;
      case 2:
        sounds.playSoundB();
        break;
      case 3:
        sounds.playSoundC();
        break;
      case 4:
        sounds.playSoundD();
        break;
      case 5:
        sounds.playSoundE();
        break;
    }
  };

  const handleSliderChange = (sliderName: string, value: number) => {
    setSliderValues((prev) => ({
      ...prev,
      [sliderName]: value,
    }));
  };

  if (!sounds.ready || !accelerometerState.hasPermission) {
    return (
      <div className="min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-white text-center mb-8">
            Algofonia
          </h1>

          <button
            onClick={requestPermission}
            className="px-3 py-1 w-full h-[6em] bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
          >
            START
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Algofonia
        </h1>

        {/* Accelerometer Monitor */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Accelerometer</h2>

            {accelerometerState.hasPermission === true && (
              <span className="text-green-400 text-sm">● Active</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">X</div>
              <div className="text-lg font-mono text-white">
                {accelerometerState.x.toFixed(2)}
              </div>
            </div>
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">Y</div>
              <div className="text-lg font-mono text-white">
                {accelerometerState.y.toFixed(2)}
              </div>
            </div>
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">Z</div>
              <div className="text-lg font-mono text-white">
                {accelerometerState.z.toFixed(2)}
              </div>
            </div>
          </div>

          {!accelerometerState.supported && (
            <div className="mt-3 text-center text-yellow-400 text-sm">
              Accelerometer not supported on this device
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => handleButtonPress(num)}
              className={`
                h-20 rounded-lg font-semibold text-white text-lg
                bg-linear-to-r from-cyan-500 to-blue-500
                hover:from-cyan-600 hover:to-blue-600
                active:scale-95 transition-all duration-150
                shadow-lg hover:shadow-xl
                ${num === 5 ? "col-span-2" : ""}
              `}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-6">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Control 1: {sliderValues.slider1}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValues.slider1}
              onChange={(e) =>
                handleSliderChange("slider1", parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Control 2: {sliderValues.slider2}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValues.slider2}
              onChange={(e) =>
                handleSliderChange("slider2", parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useRef, useCallback } from "react";
import * as Tone from "tone";

export function useSounds() {
  const startedRef = useRef(false);
  const synthRef = useRef<Tone.Synth | null>(null);
  const fmRef = useRef<Tone.FMSynth | null>(null);
  const noiseRef = useRef<Tone.NoiseSynth | null>(null);
  const membraneRef = useRef<Tone.MembraneSynth | null>(null);
  const pluckRef = useRef<Tone.PluckSynth | null>(null);
  const polyRef = useRef<Tone.PolySynth | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const pannerRef = useRef<Tone.Panner | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);

  // Must be called on a user gesture for browsers with autoplay restrictions
  const startAudioContext = useCallback(() => {
    if (startedRef.current) return Promise.resolve();
    return Tone.start().then(() => {
      // Initialize synths once
      synthRef.current = new Tone.Synth().toDestination();
      fmRef.current = new Tone.FMSynth().toDestination();
      noiseRef.current = new Tone.NoiseSynth().toDestination();
      membraneRef.current = new Tone.MembraneSynth().toDestination();
      pluckRef.current = new Tone.PluckSynth().toDestination();
      const reverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).toDestination();
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 1.5, decay: 0.2, sustain: 0.8, release: 4 },
      }).connect(reverb);
      polyRef.current = poly;
      reverbRef.current = new Tone.Reverb({ decay: 5, wet: 0.4 });
      filterRef.current = new Tone.Filter({ type: "lowpass", frequency: 8000 });
      pannerRef.current = new Tone.Panner(0);
      // connect chain
      polyRef.current.connect(filterRef.current!);
      filterRef.current.connect(pannerRef.current!);
      pannerRef.current.connect(reverbRef.current!);
      reverbRef.current.connect(Tone.getDestination());

      startedRef.current = Boolean(
        synthRef.current &&
        fmRef.current &&
        noiseRef.current &&
        membraneRef.current &&
        pluckRef.current &&
        polyRef.current &&
        reverbRef.current &&
        filterRef.current &&
        pannerRef.current &&
        Tone.getContext().state
      );
    });
  }, []);

  // Simple demo sounds
  const playSoundA = useCallback(() => {
    console.log("Playing Sound A", synthRef);
    // synthRef.current?.triggerAttackRelease("C4", "8n");
    // Pick a pleasant suspended / airy chord: C–G–D (Csus2)
    const notes = ["C4", "G4", "D5"];
    polyRef.current?.triggerAttackRelease(notes, 4); // 4-sec chord
  }, []);

  const playSoundB = useCallback(() => {
    console.log("Playing Sound B", fmRef);
    // fmRef.current?.triggerAttackRelease("G3", "8n");
    // Gadd2 chord: G–A–D
    const notes = ["G4", "A4", "D5"];
    polyRef.current?.triggerAttackRelease(notes, 4);
  }, []);

  const playSoundC = useCallback(() => {
    noiseRef.current?.triggerAttackRelease("8n");
  }, []);

  const playSoundD = useCallback(() => {
    membraneRef.current?.triggerAttackRelease("C2", "8n");
  }, []);

  const playSoundE = useCallback(() => {
    pluckRef.current?.triggerAttack("A3");
  }, []);

  const modulate = (x: number, y: number, magnitude: number) => {
    // map x tilt → -1 to 1 pan
    const pan = Math.max(-1, Math.min(1, x / 5));
    pannerRef.current?.pan.rampTo(pan, 0.1);

    // map y tilt → filter brightness (500Hz to 10kHz)
    const cutoff = 500 + (1 - (y + 5) / 10) * 9500;
    filterRef.current?.frequency.rampTo(cutoff, 0.2);

    // map shake magnitude → reverb wet
    const wet = Math.min(1, magnitude / 15);
    reverbRef.current?.wet.rampTo(wet, 0.3);
  };

  // Return API
  // eslint-disable-next-line react-hooks/refs
  return {
    playSoundA,
    playSoundB,
    playSoundC,
    playSoundD,
    playSoundE,
    // eslint-disable-next-line react-hooks/refs
    ready: startedRef.current,
    toneContext: Tone.getContext() || undefined,
    startAudioContext,
    modulate,
  };
}
