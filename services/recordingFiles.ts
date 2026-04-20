import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer } from "expo-audio";

import {
  MIN_VALID_RECORDING_MS,
  RECORDINGS_DIR_NAME,
} from "@/constants/recording";

export type RecordingFileValidation = {
  fileSizeBytes: number;
};

export function getRecordingPath(sessionId: string): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }

  return `${FileSystem.documentDirectory}${RECORDINGS_DIR_NAME}/${sessionId}.m4a`;
}

export async function ensureRecordingsDirectoryAsync() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is unavailable.");
  }

  const dir = `${FileSystem.documentDirectory}${RECORDINGS_DIR_NAME}`;
  const info = await FileSystem.getInfoAsync(dir);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function persistRecordingAsync(
  fromUri: string,
  sessionId: string,
) {
  await ensureRecordingsDirectoryAsync();
  const toUri = getRecordingPath(sessionId);
  await FileSystem.moveAsync({ from: fromUri, to: toUri });
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

  return { fileSizeBytes: size };
}
