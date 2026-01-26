import * as Tone from "tone";

export function getSampleInstrument(
  url: string,
  onLoadBuffer?: (player: Tone.Player) => void
) {
  let isLoaded = false;

  const player = new Tone.Player({
    url,
    loop: false,
    autostart: false,
    volume: -10,
    onload: () => {
      isLoaded = true;
      if (onLoadBuffer) {
        onLoadBuffer(player);
      }
    },
    onerror: (error) => {
      console.error(`Failed to load sample: ${url}`, error);
    },
  }).toDestination();

  return {
    player,
    get isLoaded() {
      return isLoaded;
    },
    hit: (time: Tone.Unit.Time) => {
      if (isLoaded) {
        // Stop any currently playing instance and start new one
        player.stop();
        player.start(time);
      }
    },
    setVolume: (volume: number) => {
      player.volume.rampTo(volume, 0.1);
    },
    dispose: () => {
      player.dispose();
    },
  };
}
