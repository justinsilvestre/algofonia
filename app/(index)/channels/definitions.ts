import { drums } from "./drums";
import { stab } from "./stab";
import { synth } from "./synth";
import { master } from "./master";
import { Channel } from "../Channel";

export type ChannelsDefinitions = typeof channelsDefinitions;
export type ChannelKey = keyof ChannelsDefinitions;

export const channelsDefinitions = {
  synth,
  drums,
  stab,
  master,
} as const;

export const channelsOrder: ChannelKey[] = ["master", "drums", "stab"];

export type ChannelOf<Key extends ChannelKey = ChannelKey> = Channel<
  Key,
  ChannelControlsOf<Key>,
  ChannelStateOf<Key>
>;
export type ChannelDefinitionOf<Key extends ChannelKey> =
  ChannelsDefinitions[Key];

export type ChannelControlsOf<Key extends ChannelKey> = ReturnType<
  ChannelDefinitionOf<Key>["initialize"]
>["controls"];
export type ChannelStateOf<Key extends ChannelKey> = ReturnType<
  ChannelDefinitionOf<Key>["initialize"]
>["state"];
