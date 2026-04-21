import type {
  ChunkIndicators,
  IndicatorExtractionCallback,
} from "@/src/types/indicators";

const FRAME_SIZE = 512;
const SAMPLE_RATE = 16000;
const ADAPTIVE_THRESHOLD_MULTIPLIER = 2.5;
const MIN_SILENCE_THRESHOLD = 0.001;
const MIN_PAUSE_FRAMES = 8;

function computeFrameRms(
  pcmChunk: Float32Array,
  frameStart: number,
  frameEnd: number,
) {
  let sumSquares = 0;
  const sampleCount = Math.max(0, frameEnd - frameStart);
  if (sampleCount === 0) {
    return 0;
  }

  for (let sampleIndex = frameStart; sampleIndex < frameEnd; sampleIndex += 1) {
    const sample = pcmChunk[sampleIndex] ?? 0;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / sampleCount);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number) {
  if (values.length === 0) {
    return 0;
  }

  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function estimateNoiseFloor(frameRms: number[]) {
  if (frameRms.length === 0) {
    return 0;
  }

  const sorted = [...frameRms].sort((left, right) => left - right);
  const index = Math.floor(frameRms.length * 0.1);
  return sorted[Math.min(index, sorted.length - 1)];
}

function createSilenceChunk() {
  return new Float32Array(SAMPLE_RATE * 10);
}

function createConstantToneChunk(amplitude: number) {
  const chunk = new Float32Array(SAMPLE_RATE * 10);
  chunk.fill(amplitude);
  return chunk;
}

void createSilenceChunk;
void createConstantToneChunk;

/**
 * Extracts PCM-derived indicators from one 10-second, 16kHz mono chunk using
 * 512-sample non-overlapping frames. Computes per-frame RMS energy, amplitude
 * threshold pauses, and a PCM-only speech activity ratio.
 */
export const indicatorExtractionCallback: IndicatorExtractionCallback = (
  chunkIndex,
  pcmChunk,
  _embeddings,
  trueChunkDurationMs,
): ChunkIndicators => {
  const realSampleCount = Math.min(
    pcmChunk.length,
    Math.max(0, Math.round((trueChunkDurationMs / 1000) * SAMPLE_RATE)),
  );
  const frameCount = Math.ceil(realSampleCount / FRAME_SIZE);
  const frameRmsValues: number[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameStart = frameIndex * FRAME_SIZE;
    const frameEnd = Math.min(frameStart + FRAME_SIZE, realSampleCount);
    const frameRms = computeFrameRms(pcmChunk, frameStart, frameEnd);
    frameRmsValues.push(frameRms);
  }

  const noiseFloor = estimateNoiseFloor(frameRmsValues);
  const silenceThreshold = Math.max(
    MIN_SILENCE_THRESHOLD,
    noiseFloor * ADAPTIVE_THRESHOLD_MULTIPLIER,
  );
  let speechFrameCount = 0;
  let silenceFrameCount = 0;
  let pauseCount = 0;
  let pauseFrames = 0;
  let longestPauseFrames = 0;
  let currentSilenceRun = 0;

  console.log(
    `[Cadence] Adaptive PCM threshold chunk ${chunkIndex}: noiseFloor=${noiseFloor.toFixed(6)} | silenceThreshold=${silenceThreshold.toFixed(6)}`,
  );

  for (const frameRms of frameRmsValues) {
    if (frameRms < silenceThreshold) {
      silenceFrameCount += 1;
      currentSilenceRun += 1;
      continue;
    }

    speechFrameCount += 1;

    if (currentSilenceRun >= MIN_PAUSE_FRAMES) {
      pauseCount += 1;
      pauseFrames += currentSilenceRun;
      longestPauseFrames = Math.max(longestPauseFrames, currentSilenceRun);
    }

    currentSilenceRun = 0;
  }

  if (currentSilenceRun >= MIN_PAUSE_FRAMES) {
    pauseCount += 1;
    pauseFrames += currentSilenceRun;
    longestPauseFrames = Math.max(longestPauseFrames, currentSilenceRun);
  }

  const meanRms = mean(frameRmsValues);
  const stdRms = standardDeviation(frameRmsValues, meanRms);
  const minRms = frameRmsValues.length > 0 ? Math.min(...frameRmsValues) : 0;
  const maxRms = frameRmsValues.length > 0 ? Math.max(...frameRmsValues) : 0;
  const speechRatio = frameCount > 0 ? speechFrameCount / frameCount : 0;
  const pauseDurationMs = (pauseFrames * FRAME_SIZE * 1000) / SAMPLE_RATE;
  const longestPauseMs = (longestPauseFrames * FRAME_SIZE * 1000) / SAMPLE_RATE;

  return {
    chunkIndex,
    chunkStartMs: chunkIndex * 10000,
    chunkDurationMs: trueChunkDurationMs,
    pause: {
      pauseCount,
      totalPauseDurationMs: pauseDurationMs,
      longestPauseMs,
      speechRatio,
    },
    energy: {
      meanRms,
      stdRms,
      minRms,
      maxRms,
    },
    pitch: null,
    speechActivity: {
      speechFrameCount,
      silenceFrameCount,
      // PCM-only ratio for Objective 1; VAD will refine this in Objective 2.
      chunkSpeechRatio: speechRatio,
    },
  };
};
