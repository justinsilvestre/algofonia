import * as Tone from "tone";

export function getStabSynth() {
  // Create a Low-Pass Filter
  const filter = new Tone.Filter({
    frequency: 1000, // 1.0k as seen on your Push
    type: "lowpass",
    rolloff: -12, // Standard analog slope
    Q: 0,
  }).toDestination();

  const filterEnvelope = new Tone.Envelope({
    attack: 0.01, // Hits instantly
    decay: 0.5, // <--- THIS IS YOUR DECAY (0.5 seconds)
    sustain: 0.2, // Drops to 20% of the max frequency
    release: 2, // Fades out slowly
    // options available on `MonoSynth` `filterEnvelope` options but not here:
    // baseFrequency: 200,
    // octaves: 4
  }).toDestination();

  const echo = new Tone.FeedbackDelay({
    delayTime: "8n.", // 1/8 note division (seen on screen)
    feedback: 0.5, // 50% Feedback
    wet: 0.7, // 70% Dry/Wet
  }).toDestination();
  const echoFilter = new Tone.Filter(1500, "lowpass")
    .connect(echo)
    .toDestination();

  // // 0 is mono, 1 is full stereo
  // const widener = new Tone.StereoWidener(0.35).toDestination();
  // const pingPong = new Tone.PingPongDelay({
  //   delayTime: "16n.",
  //   feedback: 0,
  //   wet: 0.8,
  // }).toDestination();
  // .connect(widener);
  const reverb = new Tone.Reverb({
    decay: 5,
    preDelay: 0.01,
    wet: 0.6,
  }).toDestination();
  const lowCut = new Tone.Filter({
    frequency: 900, // Only frequencies above 900Hz enter the reverb
    type: "highpass",
  })
    .connect(reverb)
    .toDestination();

  // Create a synth that uses a "fat" oscillator to mimic multiple oscillators
  const analogSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      // type: "fatsawtooth6", // A thick saw wave
      type: "fatsawtooth20", // A thick saw wave
      count: 2, // Layered voices
      spread: 10, // Detune amount
    },
  })
    // .chain(filter, echo, pingPong, reverb)
    // .chain(filter, echo, reverb)
    .chain(filter, echo)
    // .chain(filter, echo)
    .toDestination();

  analogSynth.volume.value = -12;

  return {
    analogSynth,
    filter,
    filterEnvelope,
    echo,
    dispose: () => {
      analogSynth.dispose();
      filter.dispose();
      filterEnvelope.dispose();
      echoFilter.dispose();
      echo.dispose();
      // widener.dispose();
      // pingPong.dispose();
      reverb.dispose();
      lowCut.dispose();
    },
  };
}
