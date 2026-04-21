export type StorageEventName =
  | "recordings_directory_ready"
  | "recordings_directory_created"
  | "live_recording_moved"
  | "import_recording_copied"
  | "live_recording_validated"
  | "import_recording_validated"
  | "file_delete_skipped"
  | "file_deleted";

export type StorageEventLog = {
  timestamp: string;
  sessionId?: string;
  event: StorageEventName;
  details?: Record<string, unknown>;
};

export function logStorageEvent(
  event: StorageEventName,
  payload: Omit<StorageEventLog, "timestamp" | "event"> = {},
) {
  const log: StorageEventLog = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[storage]", JSON.stringify(log));
}
