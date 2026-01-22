import {
  useState,
  useCallback,
  RefObject,
  useMemo,
  useRef,
  useEffect,
} from "react";
import * as Tone from "tone";
import {
  MessageToServer,
  MotionInputMessageToClient,
} from "../WebsocketMessage";
import { Channel, getToneControls } from "./tone";
import { channels } from "./channels";
import { useDidChange } from "./useDidChange";

const VERBOSE_LOGGING = false;

type AnyChannelState = unknown;

type MusicState = {
  activeChannels: {
    [channelKey: string]: ActiveChannel | undefined;
  };
  channelsOrder: string[];
};
export type ActiveChannel<ChannelState = AnyChannelState> = {
  channelKey: string;
  input: MusicControlChannelInputState;
  state: ChannelState;
  def: Channel<ChannelState>;
};
type MusicControlChannelInputState = {
  frontToBack: number;
  around: number;
};

export function useTone(
  startBpm: number = 100,
  nextBeatTimestampRef: RefObject<number | null>,
  offsetFromServerTimeRef?: RefObject<number | null>
) {
  const [musicState, setMusicState] = useState<MusicState>({
    activeChannels: {},
    channelsOrder: [],
  });
  const musicStateRef = useRef(musicState);
  useEffect(() => {
    musicStateRef.current = musicState;
  }, [musicState]);

  const [controls] = useState(() => getToneControls(startBpm));

  useDidChange(
    channels,
    useCallback(() => {
      // reinitialize channels state
      const newMusicState: MusicState = { ...musicState };
      newMusicState.activeChannels = { ...musicState.activeChannels };
      newMusicState.channelsOrder = [...channels.map((c) => c.key)];
      for (const channel of channels) {
        const activeChannel = newMusicState.activeChannels[channel.key];

        if (activeChannel && channel !== activeChannel?.def) {
          console.log("Tearing down old channel", channel.key, activeChannel);
          channel.teardown(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activeChannel.state as unknown as any
          );
          const initialState = channel.initialize(controls);

          console.log("Reinitializing channel", channel.key, activeChannel);
          const initialMotionInputState = newMusicState.activeChannels[
            channel.key
          ]?.input || {
            frontToBack: 0,
            around: 0,
          };
          // newMusicState.channe
          let newChannelState = initialState;
          channel.respond(
            controls,
            {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              getState: () => newChannelState as unknown as any,
              setState: (state) => {
                newChannelState =
                  typeof state === "function"
                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      state(newChannelState as unknown as any)
                    : state;
              },
            },
            initialMotionInputState
          );
          newMusicState.activeChannels[channel.key] = {
            channelKey: channel.key,
            def: channel as Channel<AnyChannelState>,
            state: newChannelState,
            input: initialMotionInputState,
          };
        }

        if (!activeChannel) {
          console.log("Initializing new channel", channel.key);
          const initialState = channel.initialize(controls);
          newMusicState.activeChannels[channel.key] = {
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
      for (const channelKey in newMusicState.activeChannels) {
        if (!channels.find((c) => c.key === channelKey)) {
          const channelState = newMusicState.activeChannels[channelKey];
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
            delete newMusicState.activeChannels[channelKey];
            newMusicState.channelsOrder = newMusicState.channelsOrder.filter(
              (key) => key !== channelKey
            );
          }
        }
      }

      setMusicState(newMusicState);
    }, [controls, musicState])
  );

  const [startedOnce, setStartedOnce] = useState(false);
  const start = useCallback(() => {
    console.log("Starting Tone AudioContext...");
    Tone.start().then(() => {
      // @ts-expect-error -- debug
      window.Tone = Tone;

      console.log("Tone AudioContext started");

      console.log("Initializing channels...");
      const initialChannels: MusicState["activeChannels"] = Object.fromEntries(
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

      setMusicState((musicState) => ({
        ...musicState,
        channelsOrder: channels.map((c) => c.key),
        activeChannels: initialChannels,
      }));

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

      setStartedOnce(true);

      const transport = Tone.getTransport();
      transport.bpm.value = startBpm;

      console.log(`Start time offset in seconds: ${startOffsetSeconds}`);
      transport.start(startOffsetSeconds);
    });

    return () => {
      console.log("Stopping Tone AudioContext...");
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);

      console.log("Tone AudioContext stopped");
    };
  }, [startBpm, controls, nextBeatTimestampRef, offsetFromServerTimeRef]);

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
      const channelState = musicState.activeChannels[channelKey]?.state as
        | AnyChannelState
        | undefined;
      if (!channelState) {
        // Might be good to eventually show an error message in this case.
        console.warn("No channel with key", channelKey);
        const channelDef = channels.find((c) => c.key === channelKey);
        if (channelDef) {
          setMusicState((musicState) => ({
            ...musicState,
            activeChannels: {
              ...musicState.activeChannels,
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
        let newChannelState = channelState;
        channel.respond(
          controls,
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getState: () => newChannelState as unknown as any,
            setState: (state) => {
              newChannelState =
                typeof state === "function"
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    state(newChannelState as unknown as any)
                  : state;
            },
          },
          message
        );

        if (newChannelState !== channelState) {
          setMusicState((musicState) => ({
            ...musicState,
            activeChannels: {
              ...musicState.activeChannels,
              [channelKey]: {
                channelKey,
                state: newChannelState,
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
        return startedOnce;
      },
    }),
    [controls, musicState, start, input, setBpm, startedOnce]
  );
}
