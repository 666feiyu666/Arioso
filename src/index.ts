export {
  composeMusic,
  type ComposeMusicOptions,
  type JazzRetrievalTrace,
} from "./composer/composer-agent.js";
export { LyriaClient, type GeneratedMusic, type GenerateMusicOptions } from "./lyria/lyria-client.js";
export {
  createJazzRetriever,
  loadJazzRetriever,
  type JazzRetriever,
  type JazzSearchMode,
  type NormalizedJazzRecord,
  type RetrievedJazzReference,
} from "./retrieval/jazz-retriever.js";
export { MusicSpecSchema, type MusicSpec } from "./schema/music-spec.js";
