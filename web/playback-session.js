// Playback state shared across page loads.
//
// Arioso navigates between full documents, so an <audio> element cannot outlive
// a page. The playlist page and the mini player both read and write this record
// so a track keeps going when the user changes page: the new page recreates the
// element at the recorded position instead of starting over.

const KEY = "arioso.playback";

/** @typedef {{ taskId: string, trackId: string, trackTitle: string, albumTitle: string, position: number, duration: number, playing: boolean, queue: Array<{ id: string, title: string, durationSeconds: number }> }} PlaybackState */

/** @returns {PlaybackState | null} */
export function readPlayback() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.taskId !== "string" || typeof value.trackId !== "string") return null;
    return {
      taskId: value.taskId,
      trackId: value.trackId,
      trackTitle: typeof value.trackTitle === "string" ? value.trackTitle : "",
      albumTitle: typeof value.albumTitle === "string" ? value.albumTitle : "",
      position: Number.isFinite(value.position) ? Number(value.position) : 0,
      duration: Number.isFinite(value.duration) ? Number(value.duration) : 0,
      playing: value.playing !== false,
      coverStyle: typeof value.coverStyle === "string" ? value.coverStyle : "",
      coverGlyph: typeof value.coverGlyph === "string" ? value.coverGlyph : "",
      queue: Array.isArray(value.queue)
        ? value.queue
          .filter((item) => item && typeof item.id === "string")
          .map((item) => ({
            id: item.id,
            title: typeof item.title === "string" ? item.title : "",
            durationSeconds: Number.isFinite(item.durationSeconds) ? Number(item.durationSeconds) : 0,
          }))
        : [],
    };
  } catch {
    return null;
  }
}

/** @param {PlaybackState} state */
export function writePlayback(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: playback simply does not survive the page change */
  }
}

export function clearPlayback() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function trackAudioUrl(taskId, trackId) {
  return `/api/tasks/${encodeURIComponent(taskId)}/album/tracks/${encodeURIComponent(trackId)}/audio`;
}
