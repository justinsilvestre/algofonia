import { defineSoundModule } from "../tone";
import { AbstractHummingSampler } from "../instruments/abstractHumSampler";
import { ArpeggioHumSampler } from "../instruments/arpeggioHumSampler";
import { BassSynth } from "../instruments/bass";
import { DarkAmbientPad } from "../instruments/darkPad";
import { PoemSampler } from "../instruments/poemSampler";
import { ProximityMelody } from "../instruments/proximityMelody";
import { ProximityPad } from "../instruments/proximityPad";

export const abstractHumSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    console.log("soundModules!", "abstractHumSampler initialized!!");
    const sampler = new AbstractHummingSampler("/samples/hum.wav"); // Default sample URL

    return {
      state: {
        volume: masterVolume,
      },
      controls: {
        sampler,
      },
    };
  },

  teardown: ({ sampler }) => {
    sampler.dispose();
  },

  onToneEvent: {},
});

export const arpeggioHumSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    const sampler = new ArpeggioHumSampler("humming.mp3", masterVolume);

    return {
      state: {
        volume: masterVolume,
        probability: 0.5,
      },
      controls: {
        sampler,
      },
    };
  },

  teardown: ({ sampler }) => {
    sampler.dispose();
  },

  onToneEvent: {},
});

export const bass = defineSoundModule({
  initialize: ({ masterVolume }) => {
    console.log("soundModules!", "bass initialized!!");
    const synth = new BassSynth(masterVolume);

    return {
      state: {
        volume: masterVolume,
      },
      controls: {
        synth,
      },
    };
  },

  teardown: ({ synth }) => {
    synth.dispose();
  },

  onToneEvent: {},
});

export const darkPad = defineSoundModule({
  initialize: ({ masterVolume }) => {
    console.log("soundModules!", "darkPad initialized!!");
    const pad = new DarkAmbientPad(masterVolume);

    return {
      state: {
        volume: masterVolume,
      },
      controls: {
        pad,
      },
    };
  },

  teardown: ({ pad }) => {
    pad.dispose();
  },

  onToneEvent: {},
});

export const poemSampler = defineSoundModule({
  initialize: ({ masterVolume }) => {
    console.log("soundModules!", "poemSampler initialized!!");
    const sampler = new PoemSampler(masterVolume);

    return {
      state: {
        volume: masterVolume,
      },
      controls: {
        sampler,
      },
    };
  },

  teardown: ({ sampler }) => {
    sampler.dispose();
  },

  onToneEvent: {},
});

export const proximityMelody = defineSoundModule({
  initialize: ({ tonic, masterVolume }) => {
    console.log("soundModules!", "proximityMelody initialized!!");
    // Create a basic major scale starting from tonic
    const scale = [`${tonic}3`, `${tonic}4`, `${tonic}5`]; // Default scale octaves
    const melody = new ProximityMelody(scale);

    return {
      state: {
        volume: masterVolume,
        proximityLevel: 0.5,
      },
      controls: {
        melody,
      },
    };
  },

  teardown: ({ melody }) => {
    melody.dispose();
  },

  onToneEvent: {},
});

export const proximityPad = defineSoundModule({
  initialize: ({ masterVolume }) => {
    console.log("soundModules!", "proximityPad initialized!!");
    const pad = new ProximityPad();

    return {
      state: {
        volume: masterVolume,
      },
      controls: {
        pad,
      },
    };
  },

  teardown: ({ pad }) => {
    pad.dispose();
  },

  onToneEvent: {},
});
