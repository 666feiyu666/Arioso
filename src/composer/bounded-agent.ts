import {
  composeMusic as composeMusicUnbounded,
} from "./composer-agent.js";
import {
  composeAlbumTrack as composeAlbumTrackUnbounded,
  planAlbum as planAlbumUnbounded,
  planPlaylist as planPlaylistUnbounded,
  refinePlaylistPlan as refinePlaylistPlanUnbounded,
  reviewAlbumCandidates as reviewAlbumCandidatesUnbounded,
  reviseAlbumTrack as reviseAlbumTrackUnbounded,
} from "./album-agent.js";
import {
  composeOrchestralMovement as composeOrchestralMovementUnbounded,
  planOrchestralWork as planOrchestralWorkUnbounded,
} from "./orchestral-agent.js";
import { DEFAULT_TIMEOUTS, type AriosoTimeouts } from "../config/env.js";
import { withDeadline } from "../utils/attempts.js";

/**
 * Deadlines for the composer agents. They cannot be cancelled mid-call, so a
 * deadline releases this process; the remote request may still finish, which is
 * why a timed-out call is never retried automatically.
 */
let deadlines: AriosoTimeouts = DEFAULT_TIMEOUTS;

export function configureModelDeadlines(next: AriosoTimeouts): void {
  deadlines = next;
}

function bounded<T>(label: string, operation: () => Promise<T>, timeoutMs?: number): Promise<T> {
  return withDeadline(() => operation(), { timeoutMs: timeoutMs ?? deadlines.composeMs, label });
}

export const composeMusic: typeof composeMusicUnbounded = (...args) =>
  bounded("composition", () => composeMusicUnbounded(...args));

export const planAlbum: typeof planAlbumUnbounded = (...args) =>
  bounded("album planning", () => planAlbumUnbounded(...args));

export const planPlaylist: typeof planPlaylistUnbounded = (...args) =>
  bounded("playlist planning", () => planPlaylistUnbounded(...args));

export const refinePlaylistPlan: typeof refinePlaylistPlanUnbounded = (...args) =>
  bounded("playlist revision", () => refinePlaylistPlanUnbounded(...args));

export const composeAlbumTrack: typeof composeAlbumTrackUnbounded = (...args) =>
  bounded("album candidate composition", () => composeAlbumTrackUnbounded(...args));

export const reviewAlbumCandidates: typeof reviewAlbumCandidatesUnbounded = (...args) =>
  bounded("album candidate review", () => reviewAlbumCandidatesUnbounded(...args));

export const reviseAlbumTrack: typeof reviseAlbumTrackUnbounded = (...args) =>
  bounded("album candidate revision", () => reviseAlbumTrackUnbounded(...args));

export const planOrchestralWork: typeof planOrchestralWorkUnbounded = (...args) =>
  bounded("orchestral planning", () => planOrchestralWorkUnbounded(...args));

export const composeOrchestralMovement: typeof composeOrchestralMovementUnbounded = (...args) =>
  bounded("orchestral movement composition", () => composeOrchestralMovementUnbounded(...args));
