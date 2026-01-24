import { ReactNode } from "react";
import { ToneControls } from "./tone";

export type Channel<Key extends string, ChannelControls, ChannelState> = {
  controls: ChannelControls;
  state: ChannelState;
  key: Key;
  definition: ChannelDefinition<ChannelControls, ChannelState>;
};

export type ChannelDefinition<ChannelControls, ChannelState> = {
  initialize: (tone: ToneControls) => {
    controls: ChannelControls;
    state: ChannelState;
  };
  teardown: (controls: ChannelControls, channelState: ChannelState) => void;
  onStateChange?: (
    tone: ToneControls,
    controls: ChannelControls,
    state: ChannelState,
    prevState: ChannelState
  ) => void;
  renderMonitorDisplay?: (
    state: ChannelState,
    setState: SetState<ChannelState>,
    toneControls: ToneControls
  ) => ReactNode;
};

export function defineChannel<ChannelControls, ChannelState>(
  definition: ChannelDefinition<ChannelControls, ChannelState>
) {
  return definition;
}
export type SetState<ChannelState> = (
  state: ChannelState | ((prevState: ChannelState) => ChannelState)
) => void;
