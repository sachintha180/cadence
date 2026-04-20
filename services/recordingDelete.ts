import type { RecordingSession } from "@/constants/types";
import { deleteAnalysisJobForRecordingAsync } from "@/services/analysisDb";
import { deletePreprocessedRecordingAsync } from "@/services/audioPreprocessing";
import { deleteRecordingSessionAsync } from "@/services/recordingDb";
import { deleteRecordingFileAsync } from "@/services/recordingFiles";

export async function deleteRecordingAsync(session: RecordingSession) {
  await deleteRecordingFileAsync(session.audioPath);
  await deletePreprocessedRecordingAsync(session.id);
  await deleteAnalysisJobForRecordingAsync(session.id);
  await deleteRecordingSessionAsync(session.id);
}

export async function discardRecordingSessionAsync(
  session: RecordingSession,
  audioPath = session.audioPath,
) {
  await deleteRecordingFileAsync(audioPath);
  await deletePreprocessedRecordingAsync(session.id);
  await deleteAnalysisJobForRecordingAsync(session.id);
  await deleteRecordingSessionAsync(session.id);
}
