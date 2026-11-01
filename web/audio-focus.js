// One sound at a time.
//
// Every player on a page registers here. Starting any of them silences the
// rest, so the only things that stop a track are the user's own actions:
// pausing it, or starting another one.

const owned = new Set();

function silence(element) {
  try {
    element.pause();
  } catch {
    /* an element with no source cannot pause; there is nothing to stop */
  }
}

/**
 * Silences every other registered player.
 * @param {HTMLAudioElement | null} element
 */
export function takeAudioFocus(element) {
  for (const other of owned) {
    if (other !== element) silence(other);
  }
  if (element) owned.add(element);
  return element;
}

/**
 * Registers an element, including ones with native controls: a click on the
 * browser's own play button fires `play`, which is where the focus is taken.
 * @param {HTMLAudioElement | null} element
 */
export function adoptAudio(element) {
  if (!element || owned.has(element)) return element;
  owned.add(element);
  element.addEventListener("play", () => takeAudioFocus(element));
  return element;
}

/**
 * Starts an element and stops everything else.
 * @param {HTMLAudioElement} element
 */
export function playExclusive(element) {
  takeAudioFocus(element);
  return element.play();
}
