import { decodeAudioData } from "react-native-audio-api";
import * as FileSystem from "expo-file-system/legacy";

import {
  PREPROCESSED_RECORDINGS_DIR_NAME,
  WAV2VEC_SAMPLE_RATE,
} from "@/constants/recording";
import type { AnalysisJob, PreprocessedAudioMetadata } from "@/constants/types";
import {
  getOrCreateAnalysisJobAsync,
  updateAnalysisJobAsync,
} from "@/services/analysisDb";
import { logAnalysisEvent } from "@/services/analysisLog";
import { getRecordingSessionAsync } from "@/services/recordingDb";

function getPreprocessedDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }
  return `${FileSystem.documentDirectory}${PREPROCESSED_RECORDINGS_DIR_NAME}`;
}

export function getPreprocessedRecordingPath(recordingSessionId: string) {
  return `${getPreprocessedDirectory()}/${recordingSessionId}-16k-mono.wav`;
}

async function ensurePreprocessedDirectoryAsync() {
  const dir = getPreprocessedDirectory();
  const info = await FileSystem.getInfoAsync(dir);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

function downmixToMono(
  audioBuffer: Awaited<ReturnType<typeof decodeAudioData>>,
) {
  if (audioBuffer.sampleRate !== WAV2VEC_SAMPLE_RATE) {
    throw new Error(
      `Decoded audio sample rate was ${audioBuffer.sampleRate} Hz, expected ${WAV2VEC_SAMPLE_RATE} Hz.`,
    );
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

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const channelCount = 1;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, pcm, true);
    offset += bytesPerSample;
  }

  return new Uint8Array(buffer);
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);

    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }

  return btoa(binary);
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

export async function preprocessRecordingAsync(
  recordingSessionId: string,
): Promise<AnalysisJob> {
  const session = await getRecordingSessionAsync(recordingSessionId);

  if (!session) {
    throw new Error("Recording not found.");
  }

  if (session.status !== "ready") {
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
    await ensurePreprocessedDirectoryAsync();
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
    const wavBytes = encodePcm16Wav(monoSamples, WAV2VEC_SAMPLE_RATE);
    const outputPath = getPreprocessedRecordingPath(recordingSessionId);

    await FileSystem.writeAsStringAsync(outputPath, uint8ToBase64(wavBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });

    const info = await FileSystem.getInfoAsync(outputPath);
    const fileSizeBytes = info.exists && "size" in info ? (info.size ?? 0) : 0;
    const metadata: PreprocessedAudioMetadata = {
      path: outputPath,
      sampleRate: WAV2VEC_SAMPLE_RATE,
      channelCount: 1,
      durationMs: Math.round((monoSamples.length / WAV2VEC_SAMPLE_RATE) * 1000),
      frameCount: monoSamples.length,
      fileSizeBytes,
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

    return nextJob;
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

    return failedJob;
  }
}
