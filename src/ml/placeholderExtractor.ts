import type {
  ChunkIndicators,
  IndicatorExtractionCallback,
} from "@/src/types/indicators";

import { CHUNK_DURATION_MS } from "./inferenceEngine";

export const placeholderExtractionCallback: IndicatorExtractionCallback = (
  chunkIndex,
  _pcmChunk,
  _embeddings,
  trueChunkDurationMs,
): ChunkIndicators => {
  return {
    chunkIndex,
    chunkStartMs: chunkIndex * CHUNK_DURATION_MS,
    chunkDurationMs: trueChunkDurationMs,
    pause: {
      pauseCount: 0,
      totalPauseDurationMs: 0,
      longestPauseMs: 0,
      speechRatio: 0,
    },
    energy: {
      meanRms: 0,
      stdRms: 0,
      minRms: 0,
      maxRms: 0,
    },
    pitch: null,
    speechActivity: {
      speechFrameCount: 0,
      silenceFrameCount: 0,
      chunkSpeechRatio: 0,
    },
  };
};
