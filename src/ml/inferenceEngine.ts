import { VAD_CONFIG } from "@/src/constants/vadConfig";
import {
  saveChunkIndicators,
  saveSessionIndicators,
} from "@/src/db/indicatorRepository";
import type { TFLiteModel } from "@/src/ml/modelLoader";
import type {
  ChunkIndicators,
  IndicatorExtractionCallback,
  SessionEnergyAggregates,
  SessionIndicators,
  SessionInferenceResult,
  SessionPauseAggregates,
  SessionPitchAggregates,
  SessionSpeechActivityAggregates,
} from "@/src/types/indicators";

const EXPECTED_CHUNK_LENGTH = 160000;
const CHUNK_DURATION_MS = 10000;

function getTrueChunkDurationMs(chunkIndex: number, totalDurationMs: number) {
  const remainingDurationMs = totalDurationMs - chunkIndex * CHUNK_DURATION_MS;
  return Math.max(0, Math.min(CHUNK_DURATION_MS, remainingDurationMs));
}

function toExactArrayBuffer(chunk: Float32Array): ArrayBuffer {
  const start = chunk.byteOffset;
  const end = start + chunk.byteLength;

  if (chunk.buffer instanceof ArrayBuffer) {
    return chunk.buffer.slice(start, end);
  }

  const bytes = new Uint8Array(chunk.byteLength);
  bytes.set(new Uint8Array(chunk.buffer, start, chunk.byteLength));
  return bytes.buffer;
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function buildPauseAggregates(
  chunkIndicators: ChunkIndicators[],
  sessionDurationMs: number,
): SessionPauseAggregates {
  const totalPauses = chunkIndicators.reduce(
    (total, chunk) => total + chunk.pause.pauseCount,
    0,
  );
  const totalPauseDurationMs = chunkIndicators.reduce(
    (total, chunk) => total + chunk.pause.totalPauseDurationMs,
    0,
  );

  return {
    totalPauses,
    totalPauseDurationMs,
    pausesPerMinute:
      sessionDurationMs > 0 ? totalPauses / (sessionDurationMs / 60000) : 0,
    averagePauseDurationMs:
      totalPauses > 0 ? totalPauseDurationMs / totalPauses : 0,
    longestPauseMs: Math.max(
      0,
      ...chunkIndicators.map((chunk) => chunk.pause.longestPauseMs),
    ),
    speechRatioTimeline: chunkIndicators.map(
      (chunk) => chunk.pause.speechRatio,
    ),
  };
}

function buildEnergyAggregates(
  chunkIndicators: ChunkIndicators[],
): SessionEnergyAggregates {
  const rmsTimeline = chunkIndicators.map((chunk) => chunk.energy.meanRms);
  const meanRms = mean(rmsTimeline);
  const rmsStd = standardDeviation(rmsTimeline);

  return {
    meanRms,
    rmsCoeffVariation: meanRms > 0 ? rmsStd / meanRms : 0,
    rmsTimeline,
    energyDropEvents: rmsTimeline.filter(
      (value) => value < meanRms * VAD_CONFIG.ENERGY_DROP_THRESHOLD_RATIO,
    ).length,
  };
}

function buildPitchAggregates(
  chunkIndicators: ChunkIndicators[],
): SessionPitchAggregates | null {
  const pitchValues = chunkIndicators
    .map((chunk) => chunk.pitch?.embeddingVariance)
    .filter((value): value is number => typeof value === "number");

  if (pitchValues.length === 0) {
    return null;
  }

  return {
    pitchVarianceTimeline: pitchValues,
    meanPitchVariance: mean(pitchValues),
    pitchVarianceStd: standardDeviation(pitchValues),
  };
}

function buildSpeechActivityAggregates(
  chunkIndicators: ChunkIndicators[],
  sessionDurationMs: number,
): SessionSpeechActivityAggregates {
  const totalSpeechMs = chunkIndicators.reduce((total, chunk) => {
    return (
      total + chunk.chunkDurationMs * chunk.speechActivity.chunkSpeechRatio
    );
  }, 0);
  const totalSilenceMs = Math.max(0, sessionDurationMs - totalSpeechMs);

  return {
    totalSpeechMs,
    totalSilenceMs,
    teacherSpeechActivityRatio:
      sessionDurationMs > 0 ? totalSpeechMs / sessionDurationMs : 0,
  };
}

function buildSessionIndicators(
  sessionId: string,
  chunkIndicators: ChunkIndicators[],
): SessionIndicators {
  const sessionDurationMs = chunkIndicators.reduce(
    (total, chunk) => total + chunk.chunkDurationMs,
    0,
  );

  return {
    sessionId,
    sessionDurationMs,
    totalChunks: chunkIndicators.length,
    computedAtMs: Date.now(),
    pause: buildPauseAggregates(chunkIndicators, sessionDurationMs),
    energy: buildEnergyAggregates(chunkIndicators),
    pitch: buildPitchAggregates(chunkIndicators),
    speechActivity: buildSpeechActivityAggregates(
      chunkIndicators,
      sessionDurationMs,
    ),
    chunkIndicators,
  };
}

export async function runSessionInference(
  model: TFLiteModel,
  chunks: Float32Array[],
  sessionId: string,
  totalDurationMs: number,
  extractionCallback: IndicatorExtractionCallback,
  onProgress?: (chunkIndex: number, total: number) => void,
): Promise<SessionInferenceResult> {
  const chunkIndicators: ChunkIndicators[] = [];
  const inferenceTimes: number[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];

    if (chunk.length !== EXPECTED_CHUNK_LENGTH) {
      console.warn(
        `[Cadence] Skipping chunk ${index}: expected ${EXPECTED_CHUNK_LENGTH} samples, received ${chunk.length}.`,
      );
      continue;
    }

    const startTime = Date.now();
    const outputs = await model.run([toExactArrayBuffer(chunk)]);
    const endTime = Date.now();
    const inferenceTimeMs = endTime - startTime;
    const output = outputs[0];

    if (!output) {
      throw new Error(`Model did not return an output for chunk ${index}.`);
    }

    const embeddings = new Float32Array(output);

    if (embeddings.length === 0) {
      throw new Error(`Model returned an empty output for chunk ${index}.`);
    }

    const preview = Array.from(embeddings.slice(0, 3)).join(", ");
    console.log(
      `[Cadence] Chunk ${index}/${chunks.length}: inference=${inferenceTimeMs}ms | output[0..2]=[${preview}]`,
    );

    const trueChunkDurationMs = getTrueChunkDurationMs(index, totalDurationMs);
    const indicators = extractionCallback(
      index,
      chunk,
      embeddings,
      trueChunkDurationMs,
    );
    await saveChunkIndicators(sessionId, indicators);
    chunkIndicators.push(indicators);
    inferenceTimes.push(inferenceTimeMs);
    onProgress?.(index + 1, chunks.length);
  }

  const totalInferenceTimeMs = inferenceTimes.reduce(
    (total, value) => total + value,
    0,
  );
  const averageChunkTimeMs =
    inferenceTimes.length > 0
      ? totalInferenceTimeMs / inferenceTimes.length
      : 0;
  const sessionIndicators = buildSessionIndicators(sessionId, chunkIndicators);
  await saveSessionIndicators(sessionIndicators);

  console.log(
    `[Cadence] Stream-and-discard complete: ${chunkIndicators.length} chunks | indicators accumulated | peak embedding memory ~1.5MB`,
  );

  return {
    sessionId,
    totalChunks: chunks.length,
    totalInferenceTimeMs,
    averageChunkTimeMs,
    sessionIndicators,
  };
}

export { CHUNK_DURATION_MS };
