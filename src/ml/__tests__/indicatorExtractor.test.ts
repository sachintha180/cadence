/**
 * Unit tests for indicatorExtractionCallback.
 *
 * Constants mirrored from indicatorExtractor.ts (not re-imported to keep tests independent):
 *   FRAME_SIZE = 512
 *   SAMPLE_RATE = 16000
 *   MIN_PAUSE_FRAMES = 8
 *   ADAPTIVE_THRESHOLD_MULTIPLIER = 2.5
 *   MIN_SILENCE_THRESHOLD = 0.001
 *   EMBEDDING_TIME_STEPS = 500
 *   EMBEDDING_DIMENSIONS = 768
 */

import { indicatorExtractionCallback } from "@/src/ml/indicatorExtractor";

const CHUNK_SAMPLES = 160000; // WAV2VEC_CHUNK_LENGTH
const FRAME_SIZE = 512;
const SAMPLE_RATE = 16000;
const MIN_PAUSE_FRAMES = 8;
const EMBEDDING_LENGTH = 500 * 768;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Helpers
function silenceChunk(): Float32Array {
  return new Float32Array(CHUNK_SAMPLES);
}

function halfLoudChunk(amplitude = 0.5): Float32Array {
  // First half: silence, second half: loud.
  // Boundary is aligned to a frame edge (156 * 512 = 79872).
  const chunk = new Float32Array(CHUNK_SAMPLES);
  chunk.fill(amplitude, 156 * FRAME_SIZE);
  return chunk;
}

function constantToneChunk(amplitude = 0.5): Float32Array {
  const chunk = new Float32Array(CHUNK_SAMPLES);
  chunk.fill(amplitude);
  return chunk;
}

// Energy metrics
describe("energy metrics", () => {
  it("silence chunk has zero mean RMS", () => {
    const result = indicatorExtractionCallback(0, silenceChunk(), null, 10000);
    expect(result.energy.meanRms).toBe(0);
    expect(result.energy.minRms).toBe(0);
    expect(result.energy.maxRms).toBe(0);
  });

  it("loud chunk has positive mean RMS", () => {
    const result = indicatorExtractionCallback(0, halfLoudChunk(), null, 10000);
    expect(result.energy.meanRms).toBeGreaterThan(0);
    expect(result.energy.maxRms).toBeGreaterThan(result.energy.minRms);
  });
});

// Pause and speech detection
describe("pause detection", () => {
  it("all-silence chunk produces one pause covering the whole chunk", () => {
    const result = indicatorExtractionCallback(0, silenceChunk(), null, 10000);
    // The entire chunk is one long silence run, counted as a single pause.
    expect(result.pause.pauseCount).toBe(1);
    expect(result.pause.speechRatio).toBe(0);
    expect(result.speechActivity.speechFrameCount).toBe(0);
    expect(result.pause.totalPauseDurationMs).toBeGreaterThan(0);
  });

  it("all-silence chunk has zero speech frames and a trailing pause longer than MIN_PAUSE_FRAMES", () => {
    const result = indicatorExtractionCallback(0, silenceChunk(), null, 10000);
    const frameCount = Math.ceil(CHUNK_SAMPLES / FRAME_SIZE); // 313
    const minPauseMs = (MIN_PAUSE_FRAMES * FRAME_SIZE * 1000) / SAMPLE_RATE;
    expect(result.speechActivity.silenceFrameCount).toBe(frameCount);
    expect(result.pause.longestPauseMs).toBeGreaterThanOrEqual(minPauseMs);
  });

  it("half-loud chunk detects speech frames in the loud region", () => {
    const result = indicatorExtractionCallback(0, halfLoudChunk(), null, 10000);
    // ~157 speech frames out of 313 total
    expect(result.speechActivity.speechFrameCount).toBeGreaterThan(100);
    expect(result.pause.speechRatio).toBeGreaterThan(0.3);
    expect(result.pause.speechRatio).toBeLessThan(0.7);
  });

  it("half-loud chunk has exactly one pause (leading silence before speech starts)", () => {
    const result = indicatorExtractionCallback(0, halfLoudChunk(), null, 10000);
    expect(result.pause.pauseCount).toBe(1);
  });

  it("constant-tone chunk: adaptive threshold silences the whole signal (no speech detected)", () => {
    // noiseFloor = amplitude (10th percentile of identical values)
    // silenceThreshold = amplitude * 2.5 > amplitude → all frames below threshold
    const result = indicatorExtractionCallback(
      0,
      constantToneChunk(0.5),
      null,
      10000,
    );
    expect(result.speechActivity.speechFrameCount).toBe(0);
    expect(result.pause.pauseCount).toBe(1);
  });
});

// Chunk index and duration metadata
describe("chunk metadata", () => {
  it("chunkIndex and chunkStartMs reflect the passed chunk index", () => {
    const result = indicatorExtractionCallback(3, silenceChunk(), null, 10000);
    expect(result.chunkIndex).toBe(3);
    expect(result.chunkStartMs).toBe(30000); // 3 * 10000
  });

  it("chunkDurationMs equals the trueChunkDurationMs argument", () => {
    const result = indicatorExtractionCallback(5, silenceChunk(), null, 5000);
    expect(result.chunkDurationMs).toBe(5000);
  });

  it("truncated chunk (5s) only analyses the first 80000 samples", () => {
    // First 80000 samples: silence. Second 80000 samples: loud.
    // With trueChunkDurationMs=5000, realSampleCount=80000, so only the silent half is seen.
    const chunk = new Float32Array(CHUNK_SAMPLES);
    chunk.fill(0.5, 80000);
    const result = indicatorExtractionCallback(0, chunk, null, 5000);
    expect(result.speechActivity.speechFrameCount).toBe(0);
    expect(result.energy.meanRms).toBe(0);
  });
});

// Pitch proxy (embedding std)
describe("pitch proxy", () => {
  it("null embeddings produce null pitch", () => {
    const result = indicatorExtractionCallback(0, silenceChunk(), null, 10000);
    expect(result.pitch).toBeNull();
  });

  it("wrong-length embeddings produce null pitch with a warning", () => {
    const embeddings = new Float32Array(100);
    const result = indicatorExtractionCallback(
      0,
      silenceChunk(),
      embeddings,
      10000,
    );
    expect(result.pitch).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("expected"),
    );
  });

  it("correct-length embeddings produce a non-null pitch object", () => {
    const embeddings = new Float32Array(EMBEDDING_LENGTH);
    const result = indicatorExtractionCallback(
      0,
      silenceChunk(),
      embeddings,
      10000,
    );
    expect(result.pitch).not.toBeNull();
    expect(result.pitch?.embeddingStd).toBeGreaterThanOrEqual(0);
  });

  it("all-zero embeddings produce embeddingStd of 0", () => {
    const embeddings = new Float32Array(EMBEDDING_LENGTH); // all zeros
    const result = indicatorExtractionCallback(
      0,
      silenceChunk(),
      embeddings,
      10000,
    );
    expect(result.pitch?.embeddingStd).toBe(0);
  });

  it("non-zero embeddings produce a positive embeddingStd", () => {
    // Alternate by time step (every 768 values) so each dimension sees 0 and 1
    // across its 500 time steps, producing a non-zero temporal std per dimension.
    const embeddings = new Float32Array(EMBEDDING_LENGTH);
    for (let step = 0; step < 500; step += 1) {
      const value = step % 2 === 0 ? 0.0 : 1.0;
      for (let dim = 0; dim < 768; dim += 1) {
        embeddings[step * 768 + dim] = value;
      }
    }
    const result = indicatorExtractionCallback(
      0,
      silenceChunk(),
      embeddings,
      10000,
    );
    expect(result.pitch?.embeddingStd).toBeGreaterThan(0);
  });
});
