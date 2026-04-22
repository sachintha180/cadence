import type { RecordingSession } from "@/constants/types";
import { deletePreprocessedRecordingAsync } from "@/services/audioPreprocessing";
import { deleteRecordingRowsAsync } from "@/services/recordingDb";
import { deleteRecordingFileAsync } from "@/services/recordingFiles";
import { logRecorderEvent } from "@/services/recordingLog";

async function bestEffortFileDelete(
  sessionId: string,
  operation: () => Promise<void>,
  failureEvent:
    | "recording_delete_file_cleanup_failed"
    | "recording_delete_preprocessed_cleanup_failed"
    | "recording_discard_file_cleanup_failed"
    | "recording_discard_preprocessed_cleanup_failed",
) {
  try {
    await operation();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logRecorderEvent(failureEvent, {
      sessionId,
      details: { message },
    });
    return message;
  }
}

export async function deleteRecordingAsync(session: RecordingSession) {
  logRecorderEvent("recording_delete_requested", { sessionId: session.id });

  try {
    await deleteRecordingRowsAsync(session.id);
  } catch (error) {
    logRecorderEvent("recording_delete_db_cleanup_failed", {
      sessionId: session.id,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  const audioCleanupError = await bestEffortFileDelete(
    session.id,
    () => deleteRecordingFileAsync(session.audioPath),
    "recording_delete_file_cleanup_failed",
  );
  const preprocessedCleanupError = await bestEffortFileDelete(
    session.id,
    () => deletePreprocessedRecordingAsync(session.id),
    "recording_delete_preprocessed_cleanup_failed",
  );

  logRecorderEvent("recording_delete_completed", {
    sessionId: session.id,
    details: {
      audioCleanupOk: audioCleanupError === null,
      preprocessedCleanupOk: preprocessedCleanupError === null,
    },
  });
}

export async function discardRecordingSessionAsync(
  session: RecordingSession,
  audioPath = session.audioPath,
) {
  logRecorderEvent("recording_discard_started", { sessionId: session.id });
  const audioCleanupError = await bestEffortFileDelete(
    session.id,
    () => deleteRecordingFileAsync(audioPath),
    "recording_discard_file_cleanup_failed",
  );
  const preprocessedCleanupError = await bestEffortFileDelete(
    session.id,
    () => deletePreprocessedRecordingAsync(session.id),
    "recording_discard_preprocessed_cleanup_failed",
  );

  let dbCleanupOk = true;

  try {
    await deleteRecordingRowsAsync(session.id);
  } catch (error) {
    dbCleanupOk = false;
    logRecorderEvent("recording_discard_db_cleanup_failed", {
      sessionId: session.id,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  logRecorderEvent("recording_discard_completed", {
    sessionId: session.id,
    details: {
      audioCleanupOk: audioCleanupError === null,
      preprocessedCleanupOk: preprocessedCleanupError === null,
      dbCleanupOk,
    },
  });
}
