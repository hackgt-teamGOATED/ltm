// One shared player for the whole app: starting a new clip stops the previous one.
// Playback always starts from a tap (no autoplay on iOS Safari, PLAN.md §7.7).
import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { create } from 'zustand';

interface PlayerState {
  /** Key of what's playing (e.g. `${messageId}:translated`), or null. */
  key: string | null;
  loading: boolean;
  playing: boolean;
  position: number;
  duration: number;
}

export const usePlayer = create<PlayerState>(() => ({ key: null, loading: false, playing: false, position: 0, duration: 0 }));

let player: AudioPlayer | null = null;
let stopAt: number | null = null;
let modeSet = false;

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  player = createAudioPlayer(null, { updateInterval: 100 });
  player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
    const p = player as AudioPlayer;
    if (stopAt !== null && s.currentTime >= stopAt) {
      p.pause();
      stopAt = null;
      usePlayer.setState({ playing: false, key: null });
      return;
    }
    usePlayer.setState({
      loading: !s.isLoaded || s.isBuffering,
      playing: s.playing,
      position: s.currentTime,
      duration: s.duration || usePlayer.getState().duration,
    });
    if (s.didJustFinish) usePlayer.setState({ playing: false, key: null, position: 0 });
  });
  return player;
}

/** Play `url`, optionally only from `from` to `to` seconds (a single word of a voice note). */
export async function play(key: string, url: string, from?: number, to?: number) {
  const p = ensurePlayer();
  if (!modeSet) {
    modeSet = true;
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }
  if (usePlayer.getState().key === key && from === undefined) {
    if (p.playing) p.pause();
    else p.play();
    return;
  }
  usePlayer.setState({ key, loading: true, playing: false, position: 0, duration: 0 });
  stopAt = to ?? null;
  p.replace({ uri: url });
  if (from !== undefined) await p.seekTo(Math.max(0, from - 0.05));
  p.play();
}

export function stop() {
  player?.pause();
  stopAt = null;
  usePlayer.setState({ key: null, playing: false, loading: false });
}
