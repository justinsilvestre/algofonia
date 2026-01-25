import type { Channel, ChannelDefinition } from "./Channel";
import type {
  ChannelKey,
  ChannelControlsOf,
  ChannelStateOf,
} from "./channels/definitions";
import { ToneControls, ToneEventMap } from "./tone";

export function createChannel<Key extends ChannelKey>(
  key: Key,
  definition: ChannelDefinition<
    ChannelControlsOf<Key>,
    ChannelStateOf<Key>,
    ToneEventMap
  >,
  tone: ToneControls
) {
  const { state, controls } = definition.initialize(tone);

  const channel: Channel<Key, typeof controls, typeof state, ToneEventMap> = {
    controls,
    state,
    key,
    definition,
    eventListeners: {},
  };
  return channel;
}
