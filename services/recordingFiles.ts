import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer } from "expo-audio";
import { decodeAudioData } from "react-native-audio-api";

import {
  MIN_VALID_RECORDING_MS,
  RECORDINGS_DIR_NAME,
  WAV2VEC_SAMPLE_RATE,
} from "@/constants/recording";
import { logStorageEvent } from "@/services/storageLog";

export type RecordingFileValidation = {
  fileSizeBytes: number;
};

export type ImportedRecordingValidation = RecordingFileValidation & {
  durationMs: number;
};

const SUPPORTED_IMPORT_EXTENSIONS = new Set(["m4a", "mp4", "wav", "mp3"]);
const MIME_EXTENSION_MAP: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "video/mp4": "mp4",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
};

export function getRecordingPath(sessionId: string): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }

  return `${FileSystem.documentDirectory}${RECORDINGS_DIR_NAME}/${sessionId}.m4a`;
}

export function getImportedRecordingPath(
  sessionId: string,
  extension: string,
): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }

  return `${FileSystem.documentDirectory}${RECORDINGS_DIR_NAME}/${sessionId}.${extension}`;
}

export function getSupportedImportExtension(
  fileNameOrUri: string,
  mimeType?: string | null,
) {
  const cleanPath = fileNameOrUri.split("?")[0] ?? fileNameOrUri;
  const extension = cleanPath.split(".").pop()?.toLowerCase();

  if (extension && SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
    return extension;
  }

  const mimeExtension = mimeType ? MIME_EXTENSION_MAP[mimeType] : undefined;

  if (!mimeExtension) {
    throw new Error("Choose an M4A, MP4, WAV, or MP3 audio file.");
  }

  return mimeExtension;
}

export async function ensureRecordingsDirectoryAsync() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }

  const dir = `${FileSystem.documentDirectory}${RECORDINGS_DIR_NAME}`;
  const info = await FileSystem.getInfoAsync(dir);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    logStorageEvent("recordings_directory_created");
    return;
  }

  logStorageEvent("recordings_directory_ready");
}

export async function persistRecordingAsync(
  fromUri: string,
  sessionId: string,
) {
  await ensureRecordingsDirectoryAsync();
  const toUri = getRecordingPath(sessionId);
  await FileSystem.moveAsync({ from: fromUri, to: toUri });
  logStorageEvent("live_recording_moved", {
    sessionId,
    details: { destination: toUri },
  });
  return toUri;
}

export async function copyImportedRecordingAsync(
  fromUri: string,
  sessionId: string,
  extension: string,
) {
  await ensureRecordingsDirectoryAsync();
  const toUri = getImportedRecordingPath(sessionId, extension);
  await FileSystem.copyAsync({ from: fromUri, to: toUri });
  logStorageEvent("import_recording_copied", {
    sessionId,
    details: { extension, destination: toUri },
  });
  return toUri;
}

export async function validateRecordingFileAsync(
  audioPath: string,
  durationMs: number,
): Promise<RecordingFileValidation> {
  const info = await FileSystem.getInfoAsync(audioPath);

  if (!info.exists) {
    throw new Error("Recording file was not created.");
  }

  const size = "size" in info ? (info.size ?? 0) : 0;

  if (size <= 0) {
    throw new Error("Recording file is empty.");
  }

  if (durationMs < MIN_VALID_RECORDING_MS) {
    throw new Error("Recording must be at least 10 seconds.");
  }

  const player = createAudioPlayer({ uri: audioPath });
  player.remove();

  logStorageEvent("live_recording_validated", {
    details: { durationMs, fileSizeBytes: size },
  });

  return { fileSizeBytes: size };
}

export async function validateImportedRecordingFileAsync(
  audioPath: string,
): Promise<ImportedRecordingValidation> {
  const info = await FileSystem.getInfoAsync(audioPath);

  if (!info.exists) {
    throw new Error("Imported file was not copied.");
  }

  const size = "size" in info ? (info.size ?? 0) : 0;

  if (size <= 0) {
    throw new Error("Imported file is empty.");
  }

  const audioBuffer = await decodeAudioData(audioPath, WAV2VEC_SAMPLE_RATE);
  const durationMs = Math.round(
    (audioBuffer.length / WAV2VEC_SAMPLE_RATE) * 1000,
  );

  if (durationMs < MIN_VALID_RECORDING_MS) {
    throw new Error("Recording must be at least 10 seconds.");
  }

  logStorageEvent("import_recording_validated", {
    details: { durationMs, fileSizeBytes: size },
  });

  return {
    fileSizeBytes: size,
    durationMs,
  };
}

export async function deleteRecordingFileAsync(audioPath: string) {
  const info = await FileSystem.getInfoAsync(audioPath);

  if (!info.exists) {
    logStorageEvent("file_delete_skipped", {
      details: { reason: "missing" },
    });
    return;
  }

  await FileSystem.deleteAsync(audioPath, { idempotent: true });
  logStorageEvent("file_deleted");
}
