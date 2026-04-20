export type SessionIndicatorStatus = "low" | "good" | "high";

export type SessionIndicatorValues = {
  value: number | string;
  unit: string;
  label: string;
  status: SessionIndicatorStatus;
};

export type Session = {
  id: number;
  title: string;
  date: string;
  duration: string;
  subject: string;
  teacherTalk: number;
  studentTalk: number;
  silence: number;
  indicators: Record<string, SessionIndicatorValues>;
  prompts: string[];
};

export type RecordingPhase = "idle" | "recording" | "processing" | "done";

export type RecordingSessionStatus =
  | "recording"
  | "stopped"
  | "ready"
  | "completed"
  | "failed";

export type RecordingSession = {
  id: string;
  createdAt: string;
  audioPath: string;
  durationMs: number;
  status: RecordingSessionStatus;
  fileSizeBytes: number | null;
  title: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

export type RecorderState =
  | "idle"
  | "requesting_permission"
  | "preparing"
  | "recording"
  | "paused"
  | "stopping"
  | "validating"
  | "ready"
  | "failed";
