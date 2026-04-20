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
  | "completed";

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

export type AnalysisJobStatus =
  | "queued"
  | "preprocessing"
  | "preprocessed"
  | "failed";

export type AnalysisJob = {
  id: string;
  recordingSessionId: string;
  status: AnalysisJobStatus;
  processedAudioPath: string | null;
  processedSampleRate: number | null;
  processedChannelCount: number | null;
  processedDurationMs: number | null;
  processedFrameCount: number | null;
  processedFileSizeBytes: number | null;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreprocessedAudioMetadata = {
  path: string;
  sampleRate: number;
  channelCount: number;
  durationMs: number;
  frameCount: number;
  fileSizeBytes: number;
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
