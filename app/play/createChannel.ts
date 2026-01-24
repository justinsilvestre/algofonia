import type { Channel, ChannelDefinition } from "./Channel";
import type {
  ChannelKey,
  ChannelControlsOf,
  ChannelStateOf,
} from "./channels/definitions";
import { ToneControls } from "./tone";

export function createChannel<Key extends ChannelKey>(
  key: Key,
  definition: ChannelDefinition<ChannelControlsOf<Key>, ChannelStateOf<Key>>,
  tone: ToneControls
) {
  const { state, controls } = definition.initialize(tone);

  const channel: Channel<Key, typeof controls, typeof state> = {
    controls,
    state,
    key,
    definition,
  };
  return channel;
}
