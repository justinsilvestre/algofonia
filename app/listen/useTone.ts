import { useState, useCallback, useRef, RefObject } from "react";
import * as Tone from "tone";
import { MotionInputMessageToClient } from "../WebsocketMessage";
import { getToneControls, ToneControls } from "./tone";
import { channels } from "./channels";

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

export function useTone(
  startBpm: number = 120,
  nextBeatTimestampRef: RefObject<number | null>,
  offsetFromServerTimeRef?: RefObject<number | null>
) {
  const [controls, setControls] = useState<ToneControls | null>(null);
  const [musicState, setMusicState] = useState<MusicState>({
    bpm: startBpm,
    channels: {},
    channelsOrder: [],
  });
  const channelsStateRef = useRef<{ [channelKey: string]: unknown }>({});

  const start = useCallback(() => {
    console.log("Starting Tone AudioContext...");
    Tone.start().then(() => {
      console.log("Tone AudioContext started");
      const controls = getToneControls((time) => {
        console.log("Tone loop at time:", time);
        const musicStateOverrides: {
          [channelKey: string]: unknown;
        } = {};
        for (const channel of channels) {
          const channelState = channelsStateRef.current[channel.key];
          const newChannelState = channel.onLoop(
            controls,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channelState as unknown as any,
            time
          );
          if (newChannelState && newChannelState !== channelState) {
            channelsStateRef.current[channel.key] = newChannelState;
            musicStateOverrides[channel.key] = newChannelState;
          }
        }
        setMusicState((musicState) => {
          for (const channelKey in musicStateOverrides) {
            musicState = {
              ...musicState,
              channels: {
                ...musicState.channels,
                [channelKey]: {
                  ...musicState.channels[channelKey],
                  state: musicStateOverrides[channelKey],
                },
              },
            };
          }
          return musicState;
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
      // set ref
      channelsStateRef.current = Object.fromEntries(
        channels.map((channel) => [
          channel.key,
          initialChannels[channel.key].state,
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
      // wait till the next beat and then start
      const startBpm = musicState.bpm;

      const startOffsetSeconds = (() => {
        const nextBeatTimestamp = nextBeatTimestampRef.current;
        if (nextBeatTimestamp == null) {
          console.warn(
            "nextBeatTimestampRef is null, starting transport immediately"
          );
          return 0;
        }
        const now = Date.now();
        let offsetFromServerTime = 0;
        if (offsetFromServerTimeRef?.current != null) {
          offsetFromServerTime = offsetFromServerTimeRef.current;
        }
        const timeUntilNextBeatMs =
          nextBeatTimestamp - (now + offsetFromServerTime);
        const offsetSeconds = timeUntilNextBeatMs / 1000;
        console.log(
          `Calculated start offset seconds: ${offsetSeconds} (timeUntilNextBeatMs: ${timeUntilNextBeatMs}, now: ${now}, nextBeatTimestamp: ${nextBeatTimestamp}, offsetFromServerTime: ${offsetFromServerTime})`
        );
        return Math.max(0, offsetSeconds);
      })();
      controls.start(startBpm, startOffsetSeconds).then(() => {
        console.log("Tone transport started");
      });
    });
  }, [musicState.bpm, nextBeatTimestampRef, offsetFromServerTimeRef]);

  const input = useCallback(
    (_channelKey: string, message: MotionInputMessageToClient) => {
      if (!controls) {
        console.warn("ToneControls not initialized yet");
        return;
      }
      const channelKey = message.userId % 2 ? "drone chord" : "arpeggio";
      const channelState = channelsStateRef.current[channelKey];
      if (!channelState) {
        // Might be good to eventually show an error message in this case.
        console.warn("No channel with key", channelKey);
        return;
      } else {
        const channel = channels.find((c) => c.key === channelKey);
        if (!channel) {
          console.warn("No channel definition for channelKey", channelKey);
          return;
        }
        console.log("Processing input for channel", channelKey, message);
        const updatedChannelState = channel.respond(
          controls,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channelState as unknown as any,
          message
        );

        if (updatedChannelState && updatedChannelState !== channelState) {
          channelsStateRef.current[channelKey] = updatedChannelState;
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
    [controls, channelsStateRef]
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
