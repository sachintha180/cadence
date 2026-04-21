// SQLite serialization notes for Phase 4B.4:
// - Timeline arrays are serialized as JSON strings.
// - Pitch placeholders in Phase 4B are stored as SQL NULL.
// - Chunk indicators are stored as one row per chunk, not as a blob.
//
// VAD implementation note for Phase 4B.3:
// The PCM pipeline uses float32 samples. Silero VAD requires int16 PCM, so the
// VAD layer converts samples with Math.round(float32Sample * 32767). The rest
// of the pipeline remains float32.

export type ChunkPauseIndicators = {
  /** Number of pauses in this chunk with duration >= PAUSE_MIN_DURATION_MS. */
  pauseCount: number;
  /** Total duration of all detected pauses in this chunk, in milliseconds. */
  totalPauseDurationMs: number;
  /** Duration of the longest detected pause in this chunk, in milliseconds. */
  longestPauseMs: number;
  /** Proportion of this chunk classified as speech, from 0.0 to 1.0. */
  speechRatio: number;
};

export type ChunkEnergyIndicators = {
  /** Mean RMS energy across 20 ms frames in this chunk. */
  meanRms: number;
  /** Standard deviation of RMS energy across frames in this chunk. */
  stdRms: number;
  /** Minimum RMS energy observed across frames in this chunk. */
  minRms: number;
  /** Maximum RMS energy observed across frames in this chunk. */
  maxRms: number;
};

export type ChunkPitchIndicators = {
  /**
   * Mean standard deviation across embedding dimensions over time. Null at the
   * chunk composite level during Phase 4B because the real model is pending.
   */
  embeddingVariance: number;
};

export type ChunkSpeechActivityIndicators = {
  /** Number of Silero VAD frames classified as speech in this chunk. */
  speechFrameCount: number;
  /** Number of Silero VAD frames classified as silence in this chunk. */
  silenceFrameCount: number;
  /** Speech frames divided by total VAD frames for this chunk, from 0.0 to 1.0. */
  chunkSpeechRatio: number;
};

export type ChunkIndicators = {
  /** Zero-based chunk index within the session. */
  chunkIndex: number;
  /** Wall-clock start of this chunk within the session, in milliseconds. */
  chunkStartMs: number;
  /** Actual chunk duration in milliseconds; final padded chunks may be shorter than 10000 ms. */
  chunkDurationMs: number;
  /** Pause metrics derived from PCM via Silero VAD. */
  pause: ChunkPauseIndicators;
  /** RMS energy metrics derived from PCM frames. */
  energy: ChunkEnergyIndicators;
  /** Embedding-derived pitch proxy; null in Phase 4B and populated in Phase 4C. */
  pitch: ChunkPitchIndicators | null;
  /** Teacher speech activity metrics derived from PCM via Silero VAD. */
  speechActivity: ChunkSpeechActivityIndicators;
};

export type SessionPauseAggregates = {
  /** Total number of detected pauses across the full session. */
  totalPauses: number;
  /** Total duration of all detected pauses across the session, in milliseconds. */
  totalPauseDurationMs: number;
  /** Detected pauses per minute of session audio. */
  pausesPerMinute: number;
  /** Mean detected pause duration across the session, in milliseconds. */
  averagePauseDurationMs: number;
  /** Longest detected pause across the session, in milliseconds. */
  longestPauseMs: number;
  /** Per-chunk speech ratio values, ordered by chunkIndex, each from 0.0 to 1.0. */
  speechRatioTimeline: number[];
};

export type SessionEnergyAggregates = {
  /** Session-wide mean RMS energy. */
  meanRms: number;
  /** RMS coefficient of variation, computed as session RMS standard deviation divided by mean RMS. */
  rmsCoeffVariation: number;
  /** Per-chunk mean RMS values, ordered by chunkIndex. */
  rmsTimeline: number[];
  /** Count of chunks whose mean RMS is below session mean RMS times ENERGY_DROP_THRESHOLD_RATIO. */
  energyDropEvents: number;
};

export type SessionPitchAggregates = {
  /** Per-chunk embedding variance values, ordered by chunkIndex. */
  pitchVarianceTimeline: number[];
  /** Mean embedding variance across the session. */
  meanPitchVariance: number;
  /** Standard deviation of per-chunk embedding variance across the session. */
  pitchVarianceStd: number;
};

export type SessionSpeechActivityAggregates = {
  /** Total duration classified as speech across the session, in milliseconds. */
  totalSpeechMs: number;
  /** Total duration classified as silence across the session, in milliseconds. */
  totalSilenceMs: number;
  /** Teacher microphone speech activity divided by session duration, from 0.0 to 1.0. */
  teacherSpeechActivityRatio: number;
};

export type SessionIndicators = {
  /** Recording session identifier associated with these indicators. */
  sessionId: string;
  /** Total analyzed session duration, in milliseconds. */
  sessionDurationMs: number;
  /** Number of chunks analyzed for this session. */
  totalChunks: number;
  /** Unix timestamp, in milliseconds, when analysis completed. */
  computedAtMs: number;
  /** Session-level pause summary. */
  pause: SessionPauseAggregates;
  /** Session-level RMS energy summary. */
  energy: SessionEnergyAggregates;
  /** Session-level embedding pitch proxy; null in Phase 4B and populated in Phase 4C. */
  pitch: SessionPitchAggregates | null;
  /** Session-level teacher speech activity summary. */
  speechActivity: SessionSpeechActivityAggregates;
  /** Per-chunk indicators ordered by chunkIndex. */
  chunkIndicators: ChunkIndicators[];
};

export type IndicatorExtractionCallback = (
  chunkIndex: number,
  pcmChunk: Float32Array,
  embeddings: Float32Array | null,
) => ChunkIndicators;

export type ChunkInferenceResult = {
  /** Zero-based chunk index within the session. */
  chunkIndex: number;
  /** TFLite inference duration for this chunk, in milliseconds. */
  inferenceTimeMs: number;
  /** Scalar indicators extracted before raw embeddings are discarded. */
  indicators: ChunkIndicators;
};

export type SessionInferenceResult = {
  /** Recording session identifier associated with this inference result. */
  sessionId: string;
  /** Number of chunks processed by the inference pipeline. */
  totalChunks: number;
  /** Total TFLite inference duration across all chunks, in milliseconds. */
  totalInferenceTimeMs: number;
  /** Mean TFLite inference duration per processed chunk, in milliseconds. */
  averageChunkTimeMs: number;
  /** Session-level and per-chunk scalar indicator output. */
  sessionIndicators: SessionIndicators;
};
