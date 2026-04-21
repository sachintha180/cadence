import type {
  ChunkIndicators,
  IndicatorExtractionCallback,
} from "@/src/types/indicators";

import { CHUNK_DURATION_MS } from "./inferenceEngine";

export const placeholderExtractionCallback: IndicatorExtractionCallback = (
  chunkIndex,
): ChunkIndicators => {
  // chunkDurationMs is approximate for the final chunk -- the callback
  // signature does not carry sessionDurationMs. 4B.3 can resolve this
  // by computing true final chunk duration as:
  // sessionDurationMs - (chunkIndex * CHUNK_DURATION_MS)
  // if sessionDurationMs is threaded through from the preprocessing result.
  const chunkDurationMs = CHUNK_DURATION_MS;

  return {
    chunkIndex,
    chunkStartMs: chunkIndex * CHUNK_DURATION_MS,
    chunkDurationMs,
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
