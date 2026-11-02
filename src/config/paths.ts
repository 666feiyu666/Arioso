import path from "node:path";

/** Default root for disposable runtime output when ARIOSO_OUTPUT_DIR is unset. */
export const DEFAULT_OUTPUT_DIRECTORY = "outputs";

/**
 * Every runtime output location, derived from the one configurable root.
 * Callers must ask for a location here instead of joining path segments
 * themselves, so a root change reaches all writers and readers at once.
 */
export interface OutputPaths {
  /** Root that holds runtime output and the stores below. */
  root: string;
  /** Authoritative task records with their audio: `<root>/tasks/<workflowType>/<taskId>`. */
  tasks: string;
  /** Creative discussion sessions: `<root>/discussions/<sessionId>`. */
  discussions: string;
  /** Mood entry records in a single file: `<root>/moodmic/entries.json`. */
  moodEntries: string;
  /** MoodMic conversations: `<root>/moodmic/chats/<chatId>`. */
  moodChats: string;
  /** Journey records: `<root>/journeys/<journeyId>.json`. */
  journeys: string;
  /**
   * Playlists and their covers/exports: `<root>/playlists/<playlistId>.json`
   * plus `<root>/playlists/<playlistId>/`. A playlist never holds audio of its
   * own; it references pieces that albums and MoodMic conversations produced.
   */
  playlists: string;
  /** Output that is no longer produced but kept as evidence: `<root>/archive`. */
  archive: string;
}

export function outputPaths(
  outputDirectory: string = process.env.ARIOSO_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIRECTORY,
): OutputPaths {
  const root = path.resolve(outputDirectory);
  return {
    root,
    tasks: path.join(root, "tasks"),
    discussions: path.join(root, "discussions"),
    moodEntries: path.join(root, "moodmic", "entries.json"),
    moodChats: path.join(root, "moodmic", "chats"),
    journeys: path.join(root, "journeys"),
    playlists: path.join(root, "playlists"),
    archive: path.join(root, "archive"),
  };
}

/**
 * User preferences live outside the output root: deleting generated output
 * must never discard the configured language.
 */
export function defaultSettingsPath(): string {
  return path.resolve(".arioso", "settings.json");
}

/** Where preferences were stored before they moved out of the output root. */
export function legacySettingsPath(
  outputDirectory: string = process.env.ARIOSO_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIRECTORY,
): string {
  return path.join(path.resolve(outputDirectory), "settings.json");
}
