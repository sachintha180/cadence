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
