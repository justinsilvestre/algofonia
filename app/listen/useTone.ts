import { useState, useCallback } from "react";
import * as Tone from "tone";
import { MotionInputMessageToClient } from "../WebsocketMessage";
import { channels, getToneControls, ToneControls } from "./tone";

type MusicState = {
  bpm: number;
  channels: {
    [channelKey: string]: {
      channelKey: string;
      input: MusicControlChannelInputState;
      state: unknown;
    };
  };
  channelsOrder: string[];
};
type MusicControlChannelInputState = {
  frontToBack: number;
  around: number;
};

export function useTone(startBpm: number = 120) {
  const [controls, setControls] = useState<ToneControls | null>(null);
  const [musicState, setMusicState] = useState<MusicState>({
    bpm: startBpm,
    channels: {},
    channelsOrder: [],
  });

  const start = useCallback(() => {
    console.log("Starting Tone AudioContext...");
    Tone.start().then(() => {
      console.log("Tone AudioContext started");
      const controls = getToneControls(() => {
        setMusicState((musicState) => {
          console.log("Updating music state on loop");
          let newMusicState = { ...musicState };
          for (const channelKey of musicState.channelsOrder) {
            const channelDef = channels.find((c) => c.key === channelKey);
            if (channelDef) {
              const channelState = newMusicState.channels[channelKey].state;
              const updatedChannelState = channelDef.onLoop(
                controls,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                channelState as unknown as any,
                0
              );
              if (updatedChannelState && updatedChannelState !== channelState) {
                newMusicState = {
                  ...newMusicState,
                  channels: {
                    ...newMusicState.channels,
                    [channelKey]: {
                      ...newMusicState.channels[channelKey],
                      state: updatedChannelState,
                    },
                  },
                };
              }
            }
          }
          return newMusicState;
        });
      });
      console.log("Initializing channels...");
      const initialChannels: MusicState["channels"] = Object.fromEntries(
        channels.map((channel) => [
          channel.key,
          {
            channelKey: channel.key,
            input: { frontToBack: 0, around: 0 },
            state: channel.initialize(controls),
          },
        ])
      );

      setMusicState((musicState) => {
        console.log("Initializing music state with channels");
        const newMusicState: MusicState = {
          ...musicState,
          channelsOrder: channels.map((c) => c.key),
          channels: initialChannels,
        };
        return newMusicState;
      });

      setControls(controls);
      controls.transport.start();
      // set initial bpm
      controls.setBpm(musicState.bpm);
      controls.loop.start(0);
    });
  }, [musicState.bpm]);

  const input = useCallback(
    (channelKey: string, message: MotionInputMessageToClient) => {
      if (!controls) {
        console.warn("ToneControls not initialized yet");
        return;
      }
      const channel =
        message.userId % 2
          ? musicState.channels["drone chord"]
          : musicState.channels["arpeggio"];
      if (!channel) {
        // Might be good to eventually show an error message in this case.
        console.warn("No channel with key", channelKey);
        return;
      } else {
        const channelDef = channels.find((c) => c.key === channel.channelKey);
        if (!channelDef) {
          console.warn(
            "No channel definition for channelKey",
            channel.channelKey
          );
          return;
        }
        // Let the channel respond to the input
        const updatedChannelState = channelDef.respond(
          controls,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channel.state as unknown as any,
          message
        );
        if (updatedChannelState && updatedChannelState !== channel.state) {
          setMusicState((musicState) => ({
            ...musicState,
            channels: {
              ...musicState.channels,
              [channelKey]: {
                ...musicState.channels[channelKey],
                state: updatedChannelState,
                input: {
                  frontToBack: message.frontToBack,
                  around: message.around,
                },
              },
            },
          }));
        }
      }
    },
    [controls, musicState.channels]
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
