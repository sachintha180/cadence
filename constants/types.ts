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
  path: string | null;
  sampleRate: number;
  channelCount: number;
  durationMs: number;
  frameCount: number;
  fileSizeBytes: number | null;
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
