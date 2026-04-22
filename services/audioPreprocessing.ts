import { decodeAudioData } from "react-native-audio-api";
import * as FileSystem from "expo-file-system/legacy";

import {
  MIN_VALID_RECORDING_MS,
  PREPROCESSED_RECORDINGS_DIR_NAME,
  WAV2VEC_CHUNK_LENGTH,
  WAV2VEC_SAMPLE_RATE,
} from "@/constants/recording";
import type { AnalysisJob, PreprocessedAudioMetadata } from "@/constants/types";
import {
  getOrCreateAnalysisJobAsync,
  updateAnalysisJobAsync,
} from "@/services/analysisDb";
import { logAnalysisEvent } from "@/services/analysisLog";
import {
  getRecordingSessionAsync,
  updateRecordingSessionAsync,
} from "@/services/recordingDb";

export type PreprocessForInferenceResult = {
  job: AnalysisJob;
  chunks: Float32Array[];
};

function getPreprocessedDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }
  return `${FileSystem.documentDirectory}${PREPROCESSED_RECORDINGS_DIR_NAME}`;
}

export function getPreprocessedRecordingPath(recordingSessionId: string) {
  return `${getPreprocessedDirectory()}/${recordingSessionId}-16k-mono.wav`;
}

function downmixToMono(
  audioBuffer: Awaited<ReturnType<typeof decodeAudioData>>,
) {
  if (audioBuffer.sampleRate !== WAV2VEC_SAMPLE_RATE) {
    throw new Error(
      `Decoded audio sample rate was ${audioBuffer.sampleRate} Hz, expected ${WAV2VEC_SAMPLE_RATE} Hz.`,
    );
  }

  if (audioBuffer.numberOfChannels <= 0) {
    throw new Error("Decoded audio did not contain any channels.");
  }

  const mono = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let index = 0; index < audioBuffer.length; index += 1) {
      mono[index] += channelData[index] / audioBuffer.numberOfChannels;
    }
  }

  return mono;
}

function chunkSamples(samples: Float32Array) {
  const chunks: Float32Array[] = [];
  const chunkCount = Math.ceil(samples.length / WAV2VEC_CHUNK_LENGTH);
  const finalChunkSamples =
    samples.length === 0 ? 0 : samples.length % WAV2VEC_CHUNK_LENGTH;
  const finalPaddingSamples =
    finalChunkSamples === 0 ? 0 : WAV2VEC_CHUNK_LENGTH - finalChunkSamples;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * WAV2VEC_CHUNK_LENGTH;
    const end = Math.min(start + WAV2VEC_CHUNK_LENGTH, samples.length);
    const chunk = new Float32Array(WAV2VEC_CHUNK_LENGTH);
    chunk.set(samples.subarray(start, end));
    chunks.push(chunk);
  }

  console.log(
    `[Cadence] Audio chunking complete: ${chunks.length} chunks | finalPaddingSamples=${finalPaddingSamples}`,
  );

  return chunks;
}

export async function deletePreprocessedRecordingAsync(
  recordingSessionId: string,
) {
  const path = getPreprocessedRecordingPath(recordingSessionId);
  const info = await FileSystem.getInfoAsync(path);

  if (!info.exists) {
    return;
  }

  await FileSystem.deleteAsync(path, { idempotent: true });
}

export async function preprocessRecordingForInferenceAsync(
  recordingSessionId: string,
): Promise<PreprocessForInferenceResult> {
  const session = await getRecordingSessionAsync(recordingSessionId);

  if (!session) {
    throw new Error("Recording not found.");
  }

  if (session.status !== "ready" && session.status !== "completed") {
    throw new Error("Recording is not ready for preprocessing.");
  }

  const job = await getOrCreateAnalysisJobAsync(recordingSessionId);
  const attemptCount = job.attemptCount + 1;

  logAnalysisEvent("preprocessing_started", {
    recordingSessionId,
    details: { attemptCount },
  });

  await updateAnalysisJobAsync(recordingSessionId, {
    status: "queued",
    attemptCount,
    errorMessage: null,
  });

  try {
    await updateAnalysisJobAsync(recordingSessionId, {
      status: "preprocessing",
      attemptCount,
      errorMessage: null,
    });

    const audioBuffer = await decodeAudioData(
      session.audioPath,
      WAV2VEC_SAMPLE_RATE,
    );
    const monoSamples = downmixToMono(audioBuffer);
    const decodedDurationMs = Math.round(
      (monoSamples.length / WAV2VEC_SAMPLE_RATE) * 1000,
    );

    if (decodedDurationMs < MIN_VALID_RECORDING_MS) {
      throw new Error("Recording must be at least 10 seconds.");
    }

    const chunks = chunkSamples(monoSamples);
    const metadata: PreprocessedAudioMetadata = {
      path: null,
      sampleRate: WAV2VEC_SAMPLE_RATE,
      channelCount: 1,
      durationMs: decodedDurationMs,
      frameCount: monoSamples.length,
      fileSizeBytes: null,
    };

    const nextJob = await updateAnalysisJobAsync(recordingSessionId, {
      status: "preprocessed",
      processedAudioPath: metadata.path,
      processedSampleRate: metadata.sampleRate,
      processedChannelCount: metadata.channelCount,
      processedDurationMs: metadata.durationMs,
      processedFrameCount: metadata.frameCount,
      processedFileSizeBytes: metadata.fileSizeBytes,
      attemptCount,
      errorMessage: null,
    });
    await updateRecordingSessionAsync(recordingSessionId, {
      durationMs: metadata.durationMs,
      fileSizeBytes: session.fileSizeBytes,
    });

    logAnalysisEvent("preprocessing_completed", {
      recordingSessionId,
      details: {
        durationMs: metadata.durationMs,
        frameCount: metadata.frameCount,
        sampleRate: metadata.sampleRate,
        channelCount: metadata.channelCount,
        fileSizeBytes: metadata.fileSizeBytes,
      },
    });

    return { job: nextJob, chunks };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preprocessing failed.";
    const failedJob = await updateAnalysisJobAsync(recordingSessionId, {
      status: "failed",
      attemptCount,
      errorMessage: message,
    });

    logAnalysisEvent("preprocessing_failed", {
      recordingSessionId,
      details: { message },
    });

    throw error;
  }
}
