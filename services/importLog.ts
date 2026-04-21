export type ImportEventName =
  | "picker_opened"
  | "picker_cancelled"
  | "file_selected"
  | "extension_resolved"
  | "copy_started"
  | "copy_completed"
  | "validation_started"
  | "validation_completed"
  | "session_created"
  | "model_requested"
  | "model_loaded"
  | "preprocessing_started"
  | "preprocessing_completed"
  | "inference_started"
  | "inference_progress"
  | "inference_completed"
  | "cleanup_completed"
  | "cleanup_failed"
  | "import_completed"
  | "import_failed";

export type ImportEventLog = {
  timestamp: string;
  sessionId?: string;
  event: ImportEventName;
  details?: Record<string, unknown>;
};

export function logImportEvent(
  event: ImportEventName,
  payload: Omit<ImportEventLog, "timestamp" | "event"> = {},
) {
  const log: ImportEventLog = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[import]", JSON.stringify(log));
}
