"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { MessageToClient, RoomState } from "../WebsocketMessage";
import { useWebsocket } from "../useWebsocket";
import { useServerTimeSync } from "./useServerTimeSync";
import { startBeats } from "./startBeats";

type MusicState = {
  bpm: number;
};

export default function OutputClientPage() {
  const [debug] = useState<boolean>(false);
  const [debugText, setDebugText] = useState<string>("");

  const [userId, setUserId] = useState<number>(0);

  const [toneController, setToneController] = useState<ToneController | null>(
    null
  );

  const [musicState, setMusicState] = useState<MusicState | null>(null);
  const nextBeatTimestampRef = useRef<number | null>(null);
  const { offsetFromServerTimeRef, processSyncReply, syncRequestsCountRef } =
    useServerTimeSync();

  const [roomState, setRoomState] = useState<RoomState>({
    inputClientsCount: 0,
    outputClientsCount: 0,
  });
  const { connectionState, sendMessage } = useWebsocket({
    handleMessage: useCallback(
      (message: MessageToClient) => {
        console.log("Received message from server:", message);
        switch (message.type) {
          case "JOIN_ROOM_REPLY":
            nextBeatTimestampRef.current = message.nextBeatTimestamp;
            setUserId(message.userId);
            setRoomState(message.roomState);
            setMusicState({
              bpm: message.bpm,
            });
            startBeats(
              message.bpm,
              message.nextBeatTimestamp,
              offsetFromServerTimeRef,
              () => {
                const flashContainer =
                  document.getElementById("flash-container");
                // Flash white
                const flashDuration = 100; // Duration of the white flash in milliseconds
                if (flashContainer)
                  flashContainer.style.backgroundColor = "white";
                // Reset background after flash duration
                setTimeout(() => {
                  const flashContainer =
                    document.getElementById("flash-container");
                  if (flashContainer) flashContainer.style.backgroundColor = "";
                }, flashDuration);
              }
            );
            break;
          case "ROOM_STATE_UPDATE":
            setRoomState(message.roomState);
            break;
          case "SYNC_REPLY": {
            const { t0, s0 } = message;
            const t1 = performance.now() + performance.timeOrigin;
            processSyncReply({ t0, s0, t1 });
            break;
          }
          case "MOTION_INPUT": {
            if (!toneController) {
              console.warn("No toneController available for MOTION_INPUT");
              setDebugText("No toneController available for MOTION_INPUT");
              break;
            }

            const { gain1, gain2 } = toneController;
            const { frontToBack, around } = message;

            const gainValue1 = frontToBack / 50;
            gain1.gain.rampTo(gainValue1);
            // Map around to gain2 (poly2)
            const gainValue2 = around / 50;
            gain2.gain.rampTo(gainValue2);

            const blue = Math.max(
              0,
              Math.min(255, Math.round((frontToBack / 100) * 255))
            );
            const green = Math.max(
              0,
              Math.min(255, Math.round((around / 100) * 255))
            );
            const container = document.getElementById("container");
            if (container) {
              container.style.backgroundColor = `rgb(0, ${green}, ${blue})`;
            }

            break;
          }
          case "SET_TEMPO": {
            // placeholder
            break;
          }
        }
      },
      [offsetFromServerTimeRef, processSyncReply, toneController]
    ),
  });

  useEffect(() => {
    if (connectionState.type === "connected") {
      console.log("Sending JOIN_ROOM_REQUEST");
      sendMessage({
        type: "JOIN_ROOM_REQUEST",
        roomName: "default",
        clientType: "output",
      });

      const syncInterval = setInterval(() => {
        sendMessage({
          type: "SYNC",
          t0: performance.now() + performance.timeOrigin,
        });
        syncRequestsCountRef.current += 1;
        if (syncRequestsCountRef.current >= 30) {
          clearInterval(syncInterval);
        }
      }, 10);
      return () => clearInterval(syncInterval);
    }
  }, [connectionState.type, sendMessage, syncRequestsCountRef]);
  if (connectionState.type !== "connected") {
    return (
      <>
        <h1>Listen</h1>
        <p>Connection status: {connectionState.type}</p>
        {connectionState.type === "error" && (
          <p>Error message: {connectionState.message}</p>
        )}
      </>
    );
  }

  const start = () => {
    Tone.start().then(() => {
      console.log("Tone AudioContext started");

      const controller = getToneController(() => {
        const notes2 = ["G4", "A4", "D5", "F5"];
        const sixteenthNoteMs = Tone.Time("16n").toMilliseconds();

        controller.poly2.triggerAttackRelease(notes2[0], "16n");
        setTimeout(() => {
          controller.poly2.triggerAttackRelease(notes2[1], "16n");
        }, sixteenthNoteMs);
        setTimeout(() => {
          controller.poly2.triggerAttackRelease(notes2[2], "16n");
        }, sixteenthNoteMs * 2);
        setTimeout(() => {
          controller.poly2.triggerAttackRelease(notes2[3], "16n");
        }, sixteenthNoteMs * 3);
      });
      setToneController(controller);
      controller.transport.start();
      controller.loopBeat.start(0);
      controller.poly1.triggerAttack(["C4", "E4", "G4"]);
    });
  };

  return (
    <div id="container" className="w-screen h-screen text-white bg-black">
      <div id="flash-container" className="w-screen h-screen p-4">
        <h1>Listen</h1>
        <p>Your user ID: {userId}</p>
        {debug && <p>{debugText}</p>}

        <p>{roomState.inputClientsCount} input clients connected</p>
        <p>{roomState.outputClientsCount} output clients connected</p>
        {musicState && <p>{musicState.bpm} BPM</p>}
        {!toneController && (
          <button className="text-white p-8" onClick={start}>
            tap to start
          </button>
        )}
      </div>
    </div>
  );
}

type ToneController = ReturnType<typeof getToneController>;
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
  };
}
