import { useState, useCallback } from "react";
import * as Tone from "tone";
import { MotionInputMessageToClient } from "../WebsocketMessage";

type ToneControls = ReturnType<typeof getToneController>;

type MusicState = {
  bpm: number;
};

export function useToneController(startBpm: number = 120) {
  const [controls, setControls] = useState<ToneControls | null>(null);
  const [musicState, setMusicState] = useState<MusicState>({ bpm: startBpm });

  const start = useCallback(() => {
    Tone.start().then(() => {
      console.log("Tone AudioContext started");

      const controls = getToneController(() => {
        const notes2 = ["G4", "A4", "D5", "F5"];
        const sixteenthNoteMs = Tone.Time("16n").toMilliseconds();

        controls.poly2.triggerAttackRelease(notes2[0], "16n");
        setTimeout(() => {
          controls.poly2.triggerAttackRelease(notes2[1], "16n");
        }, sixteenthNoteMs);
        setTimeout(() => {
          controls.poly2.triggerAttackRelease(notes2[2], "16n");
        }, sixteenthNoteMs * 2);
        setTimeout(() => {
          controls.poly2.triggerAttackRelease(notes2[3], "16n");
        }, sixteenthNoteMs * 3);
      });
      setControls(controls);
      controls.transport.start();
      // set initial bpm
      controls.setBpm(musicState.bpm);
      controls.loopBeat.start(0);
      controls.poly1.triggerAttack(["C4", "E4", "G4"]);
    });
  }, [musicState.bpm]);

  const input = useCallback(
    (message: MotionInputMessageToClient) => {
      if (!controls) {
        console.warn("ToneControls not initialized yet");
        return;
      }
      const { frontToBack, around } = message;

      const { gain1, gain2 } = controls;
      const gainValue1 = frontToBack / 50;
      gain1.gain.rampTo(gainValue1);
      // Map around to gain2 (poly2)
      const gainValue2 = around / 50;
      gain2.gain.rampTo(gainValue2);
    },
    [controls]
  );

  const setBpm = useCallback(
    (bpm: number) => {
      if (controls) {
        controls.setBpm(bpm);
        setMusicState((state) => ({ ...state, bpm }));
      }
    },
    [controls]
  );

  return { controls, musicState, start, input, setBpm };
}

function getToneController(loopCallback: (time: Tone.Unit.Seconds) => void) {
  const gain1 = new Tone.Gain(1).toDestination();
  const gain2 = new Tone.Gain(1).toDestination();

  return {
    gain1,
    gain2,
    transport: Tone.getTransport(),
    loopBeat: new Tone.Loop((time) => {
      loopCallback(time);
    }, "4n"),
    poly1: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.5, decay: 0.2, sustain: 0.8, release: 4 },
    }).connect(gain1),
    poly2: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 4 },
    }).connect(gain2),
    setBpm: (bpm: number) => {
      Tone.getTransport().bpm.value = bpm;
    },
  };
}
