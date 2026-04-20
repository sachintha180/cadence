export type RecorderEventName =
  | "permission_requested"
  | "permission_granted"
  | "permission_denied"
  | "recording_started"
  | "recording_paused"
  | "recording_resumed"
  | "recording_stopped"
  | "recording_auto_stopped"
  | "recording_validated"
  | "recording_failed"
  | "playback_started"
  | "playback_failed"
  | "interruption_pause_failed_saved";

export type RecorderEventLog = {
  timestamp: string;
  sessionId?: string;
  event: RecorderEventName;
  details?: Record<string, unknown>;
};

export function logRecorderEvent(
  event: RecorderEventName,
  payload: Omit<RecorderEventLog, "timestamp" | "event"> = {},
) {
  const log: RecorderEventLog = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[recorder]", JSON.stringify(log));
}
