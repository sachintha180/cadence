import type { RecordingSession } from "@/constants/types";
import { deleteAnalysisJobForRecordingAsync } from "@/services/analysisDb";
import { deletePreprocessedRecordingAsync } from "@/services/audioPreprocessing";
import { deleteRecordingSessionAsync } from "@/services/recordingDb";
import { deleteRecordingFileAsync } from "@/services/recordingFiles";
import { logRecorderEvent } from "@/services/recordingLog";

export async function deleteRecordingAsync(session: RecordingSession) {
  logRecorderEvent("recording_delete_requested", { sessionId: session.id });
  await deleteRecordingFileAsync(session.audioPath);
  await deletePreprocessedRecordingAsync(session.id);
  await deleteAnalysisJobForRecordingAsync(session.id);
  await deleteRecordingSessionAsync(session.id);
  logRecorderEvent("recording_delete_completed", { sessionId: session.id });
}

export async function discardRecordingSessionAsync(
  session: RecordingSession,
  audioPath = session.audioPath,
) {
  logRecorderEvent("recording_discard_started", { sessionId: session.id });
  await deleteRecordingFileAsync(audioPath);
  await deletePreprocessedRecordingAsync(session.id);
  await deleteAnalysisJobForRecordingAsync(session.id);
  await deleteRecordingSessionAsync(session.id);
  logRecorderEvent("recording_discard_completed", { sessionId: session.id });
}
