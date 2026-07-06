import { prefersReducedMotion } from "./motion";

const CHIME_SRC = "/sounds/plan-chime.wav";
const CARD_FLIP_SRC = "/sounds/card-flip.wav";

let chimeAudio = null;
let flipAudio = null;

function mayPlay(soundsEnabled) {
  if (!soundsEnabled) return false;
  if (prefersReducedMotion()) return false;
  return true;
}

function playClip(src, cache) {
  let audio = cache;
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    if (src === CHIME_SRC) chimeAudio = audio;
    else flipAudio = audio;
  }
  audio.volume = src === CHIME_SRC ? 0.42 : 0.38;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

/** Soft completion chime when weekly sync finishes (respects mute via HTML audio). */
export function playPlanChime(soundsEnabled = true) {
  if (!mayPlay(soundsEnabled)) return;
  try {
    playClip(CHIME_SRC, chimeAudio);
  } catch {
    /* ignore */
  }
}

/** Paper flip when a conversation card is revealed. */
export function playCardFlip(soundsEnabled = true) {
  if (!mayPlay(soundsEnabled)) return;
  try {
    playClip(CARD_FLIP_SRC, flipAudio);
  } catch {
    /* ignore */
  }
}

/** Workspace sounds_enabled defaults to true when unset. */
export function soundsEnabledForWorkspace(workspace) {
  return workspace?.sounds_enabled !== false;
}
