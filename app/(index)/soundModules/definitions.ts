import { drums } from "./drums";
import { drumMachine } from "./drumMachine";
import { stab } from "./stab";
import { master } from "./master";
import type { SoundModule } from "../SoundModule";
import type { ToneControls, ToneEventMap } from "../tone";

export type SoundModulesDefinitions = typeof soundModulesDefinitions;
export type SoundModuleKey = keyof SoundModulesDefinitions;

export const soundModulesDefinitions = {
  drums,
  drumMachine,
  stab,
  master,
} as const;

export const soundModulesOrder: SoundModuleKey[] = [
  "master",
  "drumMachine",
  "stab",
];

export type SoundModuleOf<Key extends SoundModuleKey = SoundModuleKey> =
  SoundModule<
    Key,
    SoundModuleControlsOf<Key>,
    SoundModuleStateOf<Key>,
    ToneControls,
    ToneEventMap
  >;
export type SoundModuleDefinitionOf<Key extends SoundModuleKey> =
  SoundModulesDefinitions[Key];

export type SoundModuleControlsOf<Key extends SoundModuleKey> = ReturnType<
  SoundModuleDefinitionOf<Key>["initialize"]
>["controls"];
export type SoundModuleStateOf<Key extends SoundModuleKey> = ReturnType<
  SoundModuleDefinitionOf<Key>["initialize"]
>["state"];
