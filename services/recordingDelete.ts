import type { RecordingSession } from "@/constants/types";
import { deleteRecordingSessionAsync } from "@/services/recordingDb";
import { deleteRecordingFileAsync } from "@/services/recordingFiles";

export async function deleteRecordingAsync(session: RecordingSession) {
  await deleteRecordingFileAsync(session.audioPath);
  await deleteRecordingSessionAsync(session.id);
}

export async function discardRecordingSessionAsync(
  session: RecordingSession,
  audioPath = session.audioPath,
) {
  await deleteRecordingFileAsync(audioPath);
  await deleteRecordingSessionAsync(session.id);
}
