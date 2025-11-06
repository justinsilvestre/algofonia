import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

type UseSoundsAPI = ReturnType<typeof useSounds>;

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
    // console.log("Playing Sound A", synthRef);
    // synthRef.current?.triggerAttackRelease("C4", "8n");
    // Pick a pleasant suspended / airy chord: C–G–D (Csus2)
    const notes = ["C4", "G4", "D5"];
    polyRef.current?.triggerAttackRelease(notes, 4); // 4-sec chord
  }, []);

  const playSoundB = useCallback(() => {
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
