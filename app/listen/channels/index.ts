import { padSynth } from "./padSynth";
import { drums } from "./drums";
import { hiHat } from "./hiHat";
import { syncopatedDrums } from "./syncopatedDrums";
import { voice } from "./voice";
import { master } from "./master";

export const channels = [
  padSynth,
  voice,
  drums,
  hiHat,
  syncopatedDrums,
  master,
];
