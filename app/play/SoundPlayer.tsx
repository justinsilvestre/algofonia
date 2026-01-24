"use client";
import { useCallback, useMemo, useState } from "react";
import * as Tone from "tone";
import { getToneControls, ToneControls } from "./tone";
import { createChannel } from "./createChannel";
import { useDidChange } from "../listen/useDidChange";
import type { SetState } from "./Channel";
import type {
  ChannelOf,
  ChannelKey,
  ChannelsDefinitions,
} from "./channels/definitions";

export function useTone(
  channelsDefinitions: ChannelsDefinitions,
  channelsOrder: ChannelKey[]
) {
  const [controls] = useState<ToneControls>(() => getToneControls());

  const [startedOnce, setStartedOnce] = useState(false);
  const [activeChannels, setActiveChannels] = useState<ChannelOf<ChannelKey>[]>(
    []
  );
  const start = useCallback(
    (startTime?: Tone.Unit.Time | undefined) => {
      return Tone.start().then(() => {
        const { transport } = controls;

        const newChannels = channelsOrder.map((key) =>
          // @ts-expect-error -- parameter type inference issue
          createChannel(key, channelsDefinitions[key], controls)
        );
        setActiveChannels(newChannels);
        console.log("Starting Tone.js Transport with channels:", newChannels);

        const startBpm = controls.getBpm();

        transport.bpm.value = startBpm;
        transport.start(startTime);

        setStartedOnce(true);
      });
    },
    [channelsDefinitions, channelsOrder, controls]
  );

  const getSetState = useCallback(
    <Key extends ChannelKey, State = ChannelOf<Key>["state"]>(
      channel: ChannelOf<Key>
    ) => {
      const index = activeChannels.findIndex((c) => c.key === channel.key);
      const setState: SetState<State> = (updater) => {
        const newChannels = [...activeChannels];
        const oldChannel = newChannels[index];
        const oldState = oldChannel.state;
        const newState =
          typeof updater === "function"
            ? (updater as (prevState: typeof oldState) => typeof oldState)(
                oldState
              )
            : updater;
        newChannels[index] = {
          ...oldChannel,
          state: newState,
        };
        // Call onStateChange if defined
        const definition = oldChannel.definition;
        if (definition.onStateChange) {
          definition.onStateChange(
            controls,
            oldChannel.controls,
            newState,
            oldState
          );
        }
        setActiveChannels(newChannels);
      };
      return setState;
    },
    [activeChannels, controls]
  );

  const channelsDef = useMemo(() => {
    return { channelsDefinitions, channelsOrder };
  }, [channelsDefinitions, channelsOrder]);
  useDidChange(channelsDef, (current, previous) => {
    console.log("Updating channels due to definition or order change");
    const newActiveChannels: ChannelOf<ChannelKey>[] = [];
    for (const newActiveChannelsKey of current.channelsOrder) {
      const oldActiveChannel = activeChannels.find(
        (c) => c.key === newActiveChannelsKey
      );
      const newChannelHasBeenAdded = !oldActiveChannel;
      if (newChannelHasBeenAdded) {
        const newActiveChannel = createChannel(
          newActiveChannelsKey,
          // @ts-expect-error -- parameter type inference issue
          current.channelsDefinitions[newActiveChannelsKey],
          controls
        );
        newActiveChannels.push(newActiveChannel);
      } else {
        // an active channel with this key has existed since before the change,
        // meaning that we need to check if its definition has changed
        const oldDefinition =
          previous.channelsDefinitions[oldActiveChannel.key];
        const newDefinition = current.channelsDefinitions[oldActiveChannel.key];
        const channelUnchanged = oldDefinition === newDefinition;
        if (channelUnchanged) {
          // keep old channel as is
          newActiveChannels.push(oldActiveChannel);
        } else {
          // Teardown old channel
          oldDefinition.teardown(
            // @ts-expect-error -- suppressing potential runtime errors when structure changes
            oldActiveChannel.controls,
            oldActiveChannel.state
          );
          const newChannelInitialState = createChannel(
            oldActiveChannel.key,
            // @ts-expect-error -- parameter type inference issue
            newDefinition,
            controls
          );
          const newActiveChannel =
            newChannelInitialState.definition.onStateChange?.(
              controls,
              newChannelInitialState.controls,
              // @ts-expect-error -- expecting objects, trying to keep typings simple
              { ...newChannelInitialState.state, ...oldActiveChannel.state },
              newChannelInitialState.state
            ) || newChannelInitialState;
          newActiveChannels.push(newActiveChannel);
        }
      }
    }

    const deletedChannels = activeChannels.filter(
      (c) => !current.channelsOrder.includes(c.key)
    );
    deletedChannels.forEach((channel) => {
      const definition = previous.channelsDefinitions[channel.key];
      definition.teardown(
        // @ts-expect-error -- suppressing potential runtime errors when structure changes
        channel.controls,
        channel.state
      );
    });

    setActiveChannels(newActiveChannels);
  });

  return useMemo(
    () => ({
      controls,
      activeChannels,
      getSetState,
      start,
      started: startedOnce,
    }),
    [controls, activeChannels, getSetState, start, startedOnce]
  );
}
