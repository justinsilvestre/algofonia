import { ReactNode } from "react";
import { ToneControls, ToneEventMap } from "./tone";

export type Channel<
  Key extends string,
  ChannelControls,
  ChannelState,
  ToneEventMap extends Record<string, unknown>,
> = {
  controls: ChannelControls;
  state: ChannelState;
  key: Key;
  eventListeners: {
    [T in keyof ToneEventMap]?: (...args: unknown[]) => unknown;
  };
  definition: ChannelDefinition<ChannelControls, ChannelState, ToneEventMap>;
};

export type ChannelDefinition<
  ChannelControls,
  ChannelState,
  ToneEventMap extends Record<string, unknown>,
> = {
  initialize: (tone: ToneControls) => {
    controls: ChannelControls;
    state: ChannelState;
  };
  teardown: (
    controls: ChannelControls,
    channelState: ChannelState,
    tone: ToneControls
  ) => void;
  onStateChange?: (
    tone: ToneControls,
    controls: ChannelControls,
    state: ChannelState,
    prevState: ChannelState
  ) => void;
  onToneEvent?: {
    [T in keyof ToneEventMap]?: (
      controls: ChannelControls,
      state: ChannelState,
      tone: ToneControls,
      arg: ToneEventMap[T]
    ) => void;
  };
  renderMonitorDisplay?: (
    state: ChannelState,
    setState: SetState<ChannelState>,
    toneControls: ToneControls,
    controls: ChannelControls
  ) => ReactNode;
};

export function defineChannel<ChannelControls, ChannelState>(
  definition: ChannelDefinition<ChannelControls, ChannelState, ToneEventMap>
) {
  return definition;
}
export type SetState<ChannelState> = (
  state: ChannelState | ((prevState: ChannelState) => ChannelState)
) => void;
