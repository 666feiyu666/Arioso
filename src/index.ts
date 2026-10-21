export {
  composeMusic,
  type ComposeMusicOptions,
} from "./composer/composer-agent.js";
export { LyriaClient, type GeneratedMusic, type GenerateMusicOptions } from "./lyria/lyria-client.js";
export {
  createMusicRetriever,
  loadMusicRetriever,
  MUSIC_TYPES,
  type MusicRetrievalTrace,
  type MusicRetriever,
  type MusicSearchMode,
  type MusicSelectionSource,
  type MusicType,
  type NormalizedMusicRecord,
  type RetrievedMusicReference,
} from "./retrieval/music-retriever.js";
export { MusicSpecSchema, type MusicSpec } from "./schema/music-spec.js";
export { runBackgroundMusicProducer } from "./producer/background-music-producer.js";
