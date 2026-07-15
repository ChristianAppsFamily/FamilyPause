import { prefersReducedMotion } from "./motion";

/** Played when Build my week / calendar sync completes. */
const BUILD_CHIME_SRC = "/sounds/build_soundfx.mp3";
const CARD_FLIP_SRC = "/sounds/card-flip.wav";

let buildChimeAudio = null;
let flipAudio = null;

function mayPlay(soundsEnabled) {
  if (!soundsEnabled) return false;
  if (prefersReducedMotion()) return false;
  return true;
}

function playClip(src, getCached, setCached, volume) {
  let audio = getCached();
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    setCached(audio);
  }
  audio.volume = volume;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

/** Completion sound when weekly sync finishes (Build my week / calendar sync). */
export function playPlanChime(soundsEnabled = true) {
  if (!mayPlay(soundsEnabled)) return;
  try {
    playClip(
      BUILD_CHIME_SRC,
      () => buildChimeAudio,
      (a) => { buildChimeAudio = a; },
      0.5,
    );
  } catch {
    /* ignore */
  }
}

/** Paper flip when a conversation card is revealed. */
export function playCardFlip(soundsEnabled = true) {
  if (!mayPlay(soundsEnabled)) return;
  try {
    playClip(
      CARD_FLIP_SRC,
      () => flipAudio,
      (a) => { flipAudio = a; },
      0.38,
    );
  } catch {
    /* ignore */
  }
}

/** Workspace sounds_enabled defaults to true when unset. */
export function soundsEnabledForWorkspace(workspace) {
  return workspace?.sounds_enabled !== false;
}
