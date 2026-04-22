export type AnalysisEventName =
  | "preprocessing_started"
  | "preprocessing_completed"
  | "preprocessing_failed";

export type AnalysisEventLog = {
  timestamp: string;
  recordingSessionId?: string;
  event: AnalysisEventName;
  details?: Record<string, unknown>;
};

export function logAnalysisEvent(
  event: AnalysisEventName,
  payload: Omit<AnalysisEventLog, "timestamp" | "event"> = {},
) {
  const log: AnalysisEventLog = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[analysis]", JSON.stringify(log));
}
