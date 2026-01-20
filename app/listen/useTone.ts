import { useState, useCallback, RefObject, useMemo } from "react";
import * as Tone from "tone";
import {
  MessageToServer,
  MotionInputMessageToClient,
} from "../WebsocketMessage";
import { Channel, getToneControls, startLoop, ToneControls } from "./tone";
import { channels } from "./channels";
import { useDidChange } from "./useDidChange";
import { produce } from "immer";

const VERBOSE_LOGGING = false;

type AnyChannelState = unknown;

type MusicState = {
  channels: {
    [channelKey: string]: {
      channelKey: string;
      input: MusicControlChannelInputState;
      state: AnyChannelState;
      def: Channel<AnyChannelState>;
    };
  };
  channelsOrder: string[];
};
type MusicControlChannelInputState = {
  frontToBack: number;
  around: number;
};

let lastLoopTime = 0;

export function useTone(
  startBpm: number = 100,
  nextBeatTimestampRef: RefObject<number | null>,
  offsetFromServerTimeRef?: RefObject<number | null>
) {
  const [musicState, setMusicState] = useState<MusicState>({
    channels: {},
    channelsOrder: [],
  });

  const [controls] = useState(() => getToneControls(startBpm));
  const [loop, setLoop] = useState<Tone.Loop | null>(null);

  const loopCallback = useCallback(
    (time: Tone.Unit.Seconds, controls: ToneControls) => {
      console.log("Tone loop at time:", time);

      // caching onLoop results to prevent double call in React strict mode
      setMusicState((currentMusicState) => {
        if (time <= lastLoopTime) {
          return currentMusicState;
        }
        lastLoopTime = time;
        const musicStateOverrides: {
          [channelKey: string]: AnyChannelState;
        } = {};

        for (const channel of channels) {
          if (currentMusicState.channels[channel.key] == null) {
            continue;
          }
          const channelState = currentMusicState.channels[channel.key]?.state;

          // );

          const newChannelState = produce(channelState, (draft) => {
            channel.onLoop(
              controls,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              draft as unknown as any,
              time
            );
          });
          if (newChannelState && newChannelState !== channelState) {
            musicStateOverrides[channel.key] = newChannelState;
          }
        }

        let musicState = currentMusicState;
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
    },
    []
  );

  useDidChange(channels, (channels) => {});

  useDidChange(
    loopCallback,
    useCallback(
      (loopCallback) => {
        if (!loop) return;
        // disconnect all active synths and audio nodes from destination

        console.log("playSound function changed, updating loop callback");
        loop.callback = (time) => loopCallback(time, controls);
        // reinitialize channels state
        const newMusicState: MusicState = { ...musicState };
        newMusicState.channels = { ...musicState.channels };
        newMusicState.channelsOrder = [...channels.map((c) => c.key)];
        for (const channel of channels) {
          const channelState = newMusicState.channels[channel.key];

          if (channelState && channel !== channelState?.def) {
            console.log("Tearing down old channel", channel.key, channelState);
            channel.teardown(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              newMusicState.channels[channel.key].state as unknown as any
            );
            const initialState = channel.initialize(controls);

            console.log(
              "Reinitializing channel",
              channel.key,
              // musicState.channels[channel.key]
              newMusicState.channels[channel.key]
            );
            // const initialMotionInputState = musicState.channels[channel.key]
            const initialMotionInputState = newMusicState.channels[channel.key]
              ?.input || {
              frontToBack: 0,
              around: 0,
            };
            newMusicState.channels[channel.key] = {
              channelKey: channel.key,
              def: channel as Channel<AnyChannelState>,
              state: produce(initialState, (draft) => {
                channel.respond(
                  controls,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  draft as unknown as any,
                  initialMotionInputState
                );
              }),
              input: initialMotionInputState,
            };
          }

          if (!channelState) {
            console.log("Initializing new channel", channel.key);
            const initialState = channel.initialize(controls);
            newMusicState.channels[channel.key] = {
              channelKey: channel.key,
              def: channel as Channel<AnyChannelState>,
              state: initialState,
              input: {
                frontToBack: 0,
                around: 0,
              },
            };
          }
        }
        // teardown channels that are no longer present
        for (const channelKey in newMusicState.channels) {
          if (!channels.find((c) => c.key === channelKey)) {
            const channelState = newMusicState.channels[channelKey];
            if (channelState) {
              console.log(
                "Tearing down removed channel",
                channelKey,
                channelState
              );
              channelState.def.teardown(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                channelState.state as unknown as any
              );
              delete newMusicState.channels[channelKey];
              newMusicState.channelsOrder = newMusicState.channelsOrder.filter(
                (key) => key !== channelKey
              );
            }
          }
        }

        setMusicState(newMusicState);
      },
      [controls, loop, musicState]
    )
  );

  // useEffect(() => {
  //   if (!loop) return;
  //   loop.callback = (time) => loopCallback(time, controls);
  // }, [loopCallback, controls, loop]);

  const start = useCallback(() => {
    console.log("Starting Tone AudioContext...");
    Tone.start().then(() => {
      console.log("Tone AudioContext started");

      console.log("Initializing channels...");
      const initialChannels: MusicState["channels"] = Object.fromEntries(
        channels.map((channel) => [
          channel.key,
          {
            channelKey: channel.key,
            input: { frontToBack: 0, around: 0 },
            state: channel.initialize(controls),
            def: channel as Channel<AnyChannelState>,
          },
        ])
      );
      console.log({ initialChannels });

      console.log("Initializing music state with channels!!");
      setMusicState((musicState) => {
        console.log("Initializing music state with channels");
        const newMusicState: MusicState = {
          ...musicState,
          channelsOrder: channels.map((c) => c.key),
          channels: initialChannels,
        };
        return newMusicState;
      });

      // wait till the next beat and then start

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
      const loop = startLoop(
        startBpm,
        startOffsetSeconds,
        controls,
        loopCallback
      );
      console.log("Tone transport started");
      setLoop(loop);
    });

    return () => {
      console.log("Stopping Tone AudioContext...");
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);

      console.log("Tone AudioContext stopped");
    };
  }, [
    startBpm,
    controls,
    loopCallback,
    nextBeatTimestampRef,
    offsetFromServerTimeRef,
  ]);

  const input = useCallback(
    (
      channelKey: string,
      message: MotionInputMessageToClient,
      sendMessage: (message: MessageToServer) => void
    ) => {
      if (!controls) {
        console.warn("ToneControls not initialized yet");
        return;
      }
      const channelState = musicState.channels[channelKey]?.state as
        | AnyChannelState
        | undefined;
      if (!channelState) {
        // Might be good to eventually show an error message in this case.
        console.warn("No channel with key", channelKey);
        const channelDef = channels.find((c) => c.key === channelKey);
        if (channelDef) {
          setMusicState((musicState) => ({
            ...musicState,
            channels: {
              ...musicState.channels,
              [channelKey]: {
                // ...musicState.channels[channelKey],
                channelKey,
                input: {
                  frontToBack: message.frontToBack,
                  around: message.around,
                },
                state: channelDef.initialize(controls),
                def: channelDef as Channel<AnyChannelState>,
              },
            },
            channelsOrder: musicState.channelsOrder.includes(channelKey)
              ? musicState.channelsOrder
              : [...musicState.channelsOrder, channelKey],
          }));
          console.log("Initialized missing channel state for", channelKey);
        }
        return;
      } else {
        const channel = channels.find((c) => c.key === channelKey);
        if (!channel) {
          console.warn("No channel definition for channelKey", channelKey);
          return;
        }
        if (VERBOSE_LOGGING)
          console.log("Processing input for channel", channelKey, message);
        const updatedChannelState = produce(channelState, (draft) => {
          channel.respond(
            controls,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            draft as unknown as any,
            message
          );
        });

        if (updatedChannelState && updatedChannelState !== channelState) {
          setMusicState((musicState) => ({
            ...musicState,
            channels: {
              ...musicState.channels,
              [channelKey]: {
                ...musicState.channels[channelKey],
                state: updatedChannelState,
                def: channel as Channel<AnyChannelState>,
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
    [controls, musicState]
  );

  const setBpm = useCallback(
    (bpm: number) => {
      if (controls) {
        console.log("Setting BPM to", bpm);
        controls.setBpm(bpm);
        setMusicState((state) => ({ ...state, bpm }));
      }
    },
    [controls]
  );

  return useMemo(
    () => ({
      controls,
      musicState,
      start,
      input,
      setBpm,
      get started() {
        return loop != null;
      },
    }),
    [controls, musicState, start, input, setBpm, loop]
  );
}
