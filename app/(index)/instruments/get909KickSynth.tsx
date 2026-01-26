import * as Tone from "tone";

export function get909KickSynth() {
  // 1. The Body: MembraneSynth handles the pitch envelope (the "oomph")
  const oscillator = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    // octaves: 10,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.4,
      sustain: 0.01,
      release: 1.4,
    },
  });

  // 2. The Attack: NoiseSynth provides the initial "click"
  const click = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.005,
      sustain: 0,
    },
  });

  // 3. Separate filters for each source to avoid soundModule count conflicts
  const oscillatorFilter = new Tone.Filter({
    type: "lowpass",
    frequency: 800,
    rolloff: -12,
  });

  const clickFilter = new Tone.Filter({
    type: "lowpass",
    frequency: 800,
    rolloff: -12,
  });

  // 4. Mix the filtered signals
  const mixer = new Tone.Gain(1);
  const output = new Tone.Gain(1);

  // Signal Chain: [Osc] -> [OscFilter] -> [Mixer]
  //               [Click] -> [ClickFilter] -> [Mixer] -> [Output] -> [Destination]
  oscillator.connect(oscillatorFilter);
  oscillatorFilter.connect(mixer);

  click.connect(clickFilter);
  clickFilter.connect(mixer);

  mixer.connect(output);
  output.toDestination();

  return {
    dispose: () => {
      oscillator.dispose();
      click.dispose();
      oscillatorFilter.dispose();
      clickFilter.dispose();
      mixer.dispose();
      output.dispose();
    },
    /**
     * Triggers the hit at a specific transport time
     */
    hit: (time: Tone.Unit.Time) => {
      // 909 kicks usually sit around G1 (approx 49Hz)
      oscillator.triggerAttackRelease("G1", "8n", time);
      click.triggerAttackRelease(time);
    },
  };
}
