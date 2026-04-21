export type DbEventName =
  | "database_initialized"
  | "recording_session_created"
  | "recording_session_updated"
  | "recording_session_update_skipped"
  | "recording_session_deleted"
  | "recording_sessions_listed"
  | "analysis_job_created"
  | "analysis_job_updated"
  | "analysis_job_deleted"
  | "indicator_chunk_saved"
  | "indicator_session_saved"
  | "indicator_rows_loaded";

export type DbEventLog = {
  timestamp: string;
  sessionId?: string;
  event: DbEventName;
  details?: Record<string, unknown>;
};

export function logDbEvent(
  event: DbEventName,
  payload: Omit<DbEventLog, "timestamp" | "event"> = {},
) {
  const log: DbEventLog = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[db]", JSON.stringify(log));
}
